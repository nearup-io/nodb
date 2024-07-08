import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Environment as EnvironmentType } from "../../src/models/environment.model.ts";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("POST /apps/:appName/:envName", async () => {
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

  test("should return 400 BAD REQUEST when environment for that app already exists", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });

    expect(response.status).toBe(201);
    // first environment
    const environmentName = "environment";
    const firstEnvironmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(firstEnvironmentResponse.status).toBe(201);

    // duplicate environment
    const secondEnvironmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });

    // expectations
    expect(secondEnvironmentResponse.status).toBe(400);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  describe("should return 401", async () => {
    test("when no backend token or JWT token is provided", async () => {
      const postAppResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });

      expect(postAppResponse.status).toBe(201);
      const appBody = await postAppResponse.json();
      const appToken = appBody.applicationTokens[0].key as string;
      // first environment
      const environmentName = "environment";
      const firstEnvironmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(firstEnvironmentResponse.status).toBe(401);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("when app token (backend token) does not have permissions for the application where it wants to add a new environment", async () => {
      const postAppResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(postAppResponse.status).toBe(201);
      const appBody = await postAppResponse.json();
      const appToken = appBody.applicationTokens[0].key;
      // first environment
      const environmentName = "environment";
      const firstEnvironmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}-2/${environmentName}`,
        backendToken: appToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(firstEnvironmentResponse.status).toBe(401);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("when environment token (backend token) does not have permissions for the current app it's trying to add an environment to", async () => {
      const postAppResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(postAppResponse.status).toBe(201);
      const appBody = await postAppResponse.json();
      const appToken = appBody.applicationTokens[0].key as string;
      const envToken = appBody.applicationTokens[0].key as string;
      // first environment
      const environmentName = "environment";
      const firstEnvironmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}-2/${environmentName}`,
        backendToken: envToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(firstEnvironmentResponse.status).toBe(401);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });

  test("should return 201 CREATED and create the environment for the app using JWT auth", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const environmentName = "environment-1";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const environment = (await helper.getEnvironmentFromDbByName(
      environmentName,
    )) as Omit<EnvironmentType, "app"> | null;
    expect(environment).not.toBeNull();
    expect(R.keys(environment!)).toEqual([
      "id",
      "name",
      "tokens",
      "entities",
      "description",
    ]);

    const { id, tokens, ...props } = environment!;
    expect(id).toBeDefined();
    expect(tokens).toBeArray();
    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const environments = await helper.getEnvironmentsFromAppName(appName);
    expect(environments).toContain(environmentName);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("should return 201 CREATED and create the environment for the app using application token (backend token) auth", async () => {
    const postAppResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(postAppResponse.status).toBe(201);
    const appBody = await postAppResponse.json();
    const appToken = appBody.applicationTokens[0].key as string;

    const environmentName = "environment-1";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: appToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const environment = (await helper.getEnvironmentFromDbByName(
      environmentName,
    )) as Omit<EnvironmentType, "app"> | null;
    expect(environment).not.toBeNull();
    expect(R.keys(environment!)).toEqual([
      "id",
      "name",
      "tokens",
      "entities",
      "description",
    ]);

    const { id, tokens, ...props } = environment!;
    expect(id).toBeDefined();
    expect(tokens).toBeArray();
    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const environments = await helper.getEnvironmentsFromAppName(appName);
    expect(environments).toContain(environmentName);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("should return 201 CREATED and create the environment for the app using environment token (backend token) auth", async () => {
    const postAppResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(postAppResponse.status).toBe(201);
    const appBody = await postAppResponse.json();
    const appToken = appBody.applicationTokens[0].key as string;
    const envToken = appBody.environmentTokens[0].key as string;

    const environmentName = "environment-1";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: envToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const environment = (await helper.getEnvironmentFromDbByName(
      environmentName,
    )) as Omit<EnvironmentType, "app"> | null;
    expect(environment).not.toBeNull();
    expect(R.keys(environment!)).toEqual([
      "id",
      "name",
      "tokens",
      "entities",
      "description",
    ]);

    const { id, tokens, ...props } = environment!;
    expect(id).toBeDefined();
    expect(tokens).toBeArray();
    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const environments = await helper.getEnvironmentsFromAppName(appName);
    expect(environments).toContain(environmentName);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteResponse.status).toBe(200);
  });
});
