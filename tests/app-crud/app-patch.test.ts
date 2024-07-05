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
        token: jwtToken,
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
        token: jwtToken,
        body: {
          appName: faultyAppName,
        },
      });
      expect(response.status).toBe(400);

      const response1 = await helper.executePatchRequest({
        url: `/apps/${faultyAppName}`,
        token: jwtToken,
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
        token: jwtToken,
        body: {
          appName,
        },
      });
      expect(response.status).toBe(400);
    });
  });

  test("Should return 404 NOT FOUND and return proper body when app is not found", async () => {
    const appName = "random-app";
    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
      body: {
        appName: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      },
    });

    expect(patchResponse.status).toBe(404);
    expect(await patchResponse.json()).toEqual({ found: false });
  });

  test("Should return 200 OK and update app props in db properly", async () => {
    const appName = "random-app";
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "some description",
      },
    });
    expect(postResponse.status).toBe(201);

    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
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
    expect(tokens).toStrictEqual(environments[0].tokens);

    await helper.deleteAppByName("new-app-name");
  });
});
