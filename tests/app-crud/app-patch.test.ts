import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("App endpoint PATCH", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("Should return 400 BAD REQUEST", async () => {
    test("when appName prop in body exists and its too short", async () => {
      const shortAppName = "ap";
      const response = await helper.executePatchRequest({
        url: `/apps/memes-app`,
        jwtToken,
        body: {
          appName: shortAppName,
        },
      });
      expect(response.status).toBe(400);
    });

    test("when appName prop in body exists and contains invalid characters", async () => {
      const faultyAppName = "app_?test";

      const response = await helper.executePatchRequest({
        url: `/apps/memes-app`,
        jwtToken,
        body: {
          appName: faultyAppName,
        },
      });
      expect(response.status).toBe(400);

      const response1 = await helper.executePatchRequest({
        url: `/apps/${faultyAppName}`,
        jwtToken,
        body: {
          appName: "memes-app",
        },
      });
      expect(response1.status).toBe(400);
    });

    test("when appName prop in body exists and it's the same as the existing appName", async () => {
      const appName = "testApp";

      const response = await helper.executePatchRequest({
        url: `/apps/${appName}`,
        jwtToken,
        body: {
          appName,
        },
      });
      expect(response.status).toBe(400);
    });
  });

  test("Should return 401 FORBIDDEN when no JWT token or backend token is provided", async () => {
    const appName = "random-app";
    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}`,
      body: {
        appName: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      },
    });

    expect(patchResponse.status).toBe(401);
  });

  test("Should return 403 FORBIDDEN when trying to update an application that the application token (backend token) does not have permissions to", async () => {
    const appName = "test-app";
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "some description",
      },
    });
    expect(postResponse.status).toBe(201);

    const token = (await postResponse.json()).applicationTokens[0]
      .key as string;

    const patchResponse = await helper.executePatchRequest({
      url: `/apps/different-app`,
      backendToken: token,
      body: {
        appName: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      },
    });

    expect(patchResponse.status).toBe(403);
  });

  test("Should return 403 FORBIDDEN when trying to update an application that the environment token (backend token) does not have permissions to", async () => {
    const appName = "test-app-2";
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "some description",
      },
    });
    expect(postResponse.status).toBe(201);

    const token = (await postResponse.json()).environmentTokens[0]
      .key as string;

    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}`,
      backendToken: token,
      body: {
        appName: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      },
    });

    expect(patchResponse.status).toBe(403);
  });

  // TODO implements once we have a mechanism for generating READ ONLY tokens
  test.skip("Should return 401 FORBIDDEN when the backend token contains only READ_ONLY permissions", async () => {});

  test("Should return 404 NOT FOUND and return proper body when app is not found", async () => {
    const appName = "random-app";
    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        appName: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      },
    });

    expect(patchResponse.status).toBe(404);
    expect(await patchResponse.json()).toEqual({ found: false });
  });

  test("Should return 200 OK and update app props in db properly when auth is JWT token", async () => {
    const appName = "random-app";
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "some description",
      },
    });
    expect(postResponse.status).toBe(201);

    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        appName: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      },
    });

    expect(patchResponse.status).toBe(200);
    expect(await patchResponse.json()).toEqual({ found: true });
    const dbResult = await helper.getAppFromDbByName("new-app-name");
    expect(dbResult).not.toBeNull();
    const { id, environments, tokens, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    // one environment is automatically created
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      name: "new-app-name",
      description: "new description",
      image: "path/to/image-new.jpg",
    });
    expect(tokens.length).toBe(1);
    expect(Object.keys(tokens[0]).sort()).toStrictEqual(
      ["key", "permission"].sort(),
    );
    expect(environments[0].tokens.length).toBe(1);
    expect(Object.keys(environments[0].tokens[0]).sort()).toStrictEqual(
      ["key", "permission"].sort(),
    );

    await helper.deleteAppByName("new-app-name");
  });

  test("Should return 200 OK and update app props in db properly when auth backend token", async () => {
    const appName = "random-app-2";
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "some description",
      },
    });
    expect(postResponse.status).toBe(201);

    const token = (await postResponse.json()).applicationTokens[0]
      .key as string;

    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}`,
      backendToken: token,
      body: {
        appName: "new-app-name-2",
        description: "new description",
        image: "path/to/image-new.jpg",
      },
    });

    expect(patchResponse.status).toBe(200);
    expect(await patchResponse.json()).toEqual({ found: true });
    const dbResult = await helper.getAppFromDbByName("new-app-name-2");
    expect(dbResult).not.toBeNull();
    const { id, environments, tokens, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    // one environment is automatically created
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      name: "new-app-name-2",
      description: "new description",
      image: "path/to/image-new.jpg",
    });
    expect(tokens.length).toBe(1);
    expect(Object.keys(tokens[0]).sort()).toStrictEqual(
      ["key", "permission"].sort(),
    );
    expect(environments[0].tokens.length).toBe(1);
    expect(Object.keys(environments[0].tokens[0]).sort()).toStrictEqual(
      ["key", "permission"].sort(),
    );

    await helper.deleteAppByName("new-app-name-2");
  });
});
