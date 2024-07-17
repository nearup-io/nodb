import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Environment as EnvironmentType } from "../../src/models/environment.model.ts";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";
import { deepEqual } from "assert";

describe("GET /apps/:appName/:envName", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";
  const appName = "test-app-name";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  test("should return 401 UNAUTHORIZED when no backend token or JWT token is provided", async () => {
    const getResponse = await helper.executeGetRequest({
      url: `/apps/${appName}/environment`,
    });

    expect(getResponse.status).toBe(401);
  });

  describe("should return 403 FORBIDDEN", async () => {
    test("when app token (backend token) does not have permissions for the environment", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);

      const appToken = (await response.json()).applicationTokens[0]
        .key as string;

      const getResponse = await helper.executeGetRequest({
        url: `/apps/${appName}/environment`,
        backendToken: appToken,
      });

      expect(getResponse.status).toBe(403);

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });

    test("when environment token (backend token) does not have permissions for the environment", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);

      const body = await response.json();
      const appToken = body.applicationTokens[0].key as string;
      const envToken = body.environmentTokens[0].key as string;

      const getResponse = await helper.executeGetRequest({
        url: `/apps/${appName}/environment`,
        backendToken: envToken,
      });

      expect(getResponse.status).toBe(403);

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });
  });

  test("should return 404 NOT FOUND when environment is not found", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);

    const getResponse = await helper.executeGetRequest({
      url: `/apps/${appName}/not-existing-environment`,
      jwtToken,
    });

    expect(getResponse.status).toBe(404);

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and environment when using jwt token auth", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const environmentName = "environment";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const getResponse = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken,
    });

    expect(getResponse.status).toBe(200);

    const body = (await getResponse.json()) as Omit<EnvironmentType, "app">;

    deepEqual(
      R.keys(body).sort(),
      ["id", "name", "description", "tokens", "entities"].sort(),
    );

    const { id, tokens, ...props } = body;

    expect(id).toBeString();
    expect(tokens).toBeArray();

    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and environment when using application token (backend token) auth", async () => {
    const environmentName = "environment";
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
        environmentName,
        environmentDescription: "This is a staging environment",
      },
    });

    expect(postResponse.status).toBe(201);
    const postBody = await postResponse.json();
    const appToken = postBody.applicationTokens[0].key as string;

    const getResponse = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: appToken,
    });

    expect(getResponse.status).toBe(200);

    const body = (await getResponse.json()) as Omit<EnvironmentType, "app">;

    deepEqual(
      R.keys(body).sort(),
      ["id", "name", "description", "tokens", "entities"].sort(),
    );

    const { id, tokens, ...props } = body;

    expect(id).toBeString();
    expect(tokens).toBeArray();

    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and environment when using environment token (backend token) auth", async () => {
    const environmentName = "environment";
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
        environmentName,
        environmentDescription: "This is a staging environment",
      },
    });

    expect(postResponse.status).toBe(201);
    const postBody = await postResponse.json();
    const appToken = postBody.applicationTokens[0].key as string;
    const envToken = postBody.environmentTokens[0].key as string;

    const getResponse = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: envToken,
    });

    expect(getResponse.status).toBe(200);

    const body = (await getResponse.json()) as Omit<EnvironmentType, "app">;

    deepEqual(
      R.keys(body).sort(),
      ["id", "name", "description", "tokens", "entities"].sort(),
    );

    const { id, tokens, ...props } = body;

    expect(id).toBeString();
    expect(tokens).toBeArray();

    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });
});
