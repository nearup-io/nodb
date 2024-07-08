import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Environment as EnvironmentType } from "../../src/models/environment.model.ts";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("PATCH /apps/:appName/:envName", async () => {
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

  describe("should return 400 BAD REQUEST", () => {
    test("when you try to rename the environment to the same name", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        jwtToken: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });

      expect(response.status).toBe(201);
      // first environment
      const environmentName = "environment";
      const firstEnvironmentResponse = await helper.executePatchRequest({
        url: `/apps/${appName}/${environmentName}`,
        jwtToken: jwtToken,
        body: {
          envName: environmentName,
          description: "This is a staging environment",
        },
      });
      expect(firstEnvironmentResponse.status).toBe(400);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        jwtToken: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("when no props are passed to be updated", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        jwtToken: jwtToken,
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
        jwtToken: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(firstEnvironmentResponse.status).toBe(201);

      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}/${environmentName}`,

        jwtToken: jwtToken,
        body: {},
      });
      expect(patchResponse.status).toBe(400);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        jwtToken: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("when new environment name already exists", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        jwtToken: jwtToken,
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
        jwtToken: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(firstEnvironmentResponse.status).toBe(201);

      const secondEnvironmentName = "environment-2";
      const secondEnvironmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${secondEnvironmentName}`,
        jwtToken: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(secondEnvironmentResponse.status).toBe(201);

      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}/${environmentName}`,
        jwtToken: jwtToken,
        body: { envName: secondEnvironmentName },
      });
      expect(patchResponse.status).toBe(400);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        jwtToken: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });

  describe("should return 401", async () => {
    test("when no backend token or JWT token is provided", async () => {
      const appPostResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(appPostResponse.status).toBe(201);
      const body = await appPostResponse.json();
      const appToken = body.applicationTokens[0].key as string;

      const environmentName = "environment-1";

      const updatedEnvName = "updated-environment";
      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}/${environmentName}`,
        body: {
          envName: updatedEnvName,
          description: "updated description",
        },
      });
      expect(patchResponse.status).toBe(401);
      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("when app token (backend token) does not have permissions for the application it needs to update the environment", async () => {
      const environmentName = "environment-1";
      const appPostResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
          environmentName,
        },
      });
      expect(appPostResponse.status).toBe(201);
      const body = await appPostResponse.json();
      const appToken = body.applicationTokens[0].key as string;
      const updatedEnvName = "updated-environment";
      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}-1/${environmentName}`,
        backendToken: appToken,
        body: {
          envName: updatedEnvName,
          description: "updated description",
        },
      });
      expect(patchResponse.status).toBe(401);
      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("when environment token (backend token) does not have permissions for the current environment that it's trying to update", async () => {
      const environmentName = "environment-1";
      const appPostResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
          environmentName,
        },
      });
      expect(appPostResponse.status).toBe(201);
      const body = await appPostResponse.json();
      const appToken = body.applicationTokens[0].key as string;
      const envToken = body.environmentTokens[0].key as string;

      const updatedEnvName = "updated-environment";
      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}/dev`,
        backendToken: envToken,
        body: {
          envName: updatedEnvName,
          description: "updated description",
        },
      });
      expect(patchResponse.status).toBe(401);
      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });

  test("should return 404 NOT FOUND when the environment does not exist", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });

    expect(response.status).toBe(201);
    // first environment
    const environmentName = "environment";
    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
      body: {
        envName: "new-env-name",
        description: "This is a staging environment",
      },
    });
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("should return 200 OK and update the environment with jwt auth", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const environmentName = "environment-1";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const updatedEnvName = "updated-environment";
    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
      body: {
        envName: updatedEnvName,
        description: "updated description",
      },
    });
    expect(patchResponse.status).toBe(200);

    const environment = (await helper.getEnvironmentFromDbByName(
      updatedEnvName,
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
      description: "updated description",
      entities: [],
      name: updatedEnvName,
    });

    const environments = await helper.getEnvironmentsFromAppName(appName);
    expect(environments).toContain(updatedEnvName);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("should return 200 OK and update the environment with application token (backend token) auth", async () => {
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

    const updatedEnvName = "updated-environment";
    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: appToken,
      body: {
        envName: updatedEnvName,
        description: "updated description",
      },
    });
    expect(patchResponse.status).toBe(200);

    const environment = (await helper.getEnvironmentFromDbByName(
      updatedEnvName,
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
      description: "updated description",
      entities: [],
      name: updatedEnvName,
    });

    const environments = await helper.getEnvironmentsFromAppName(appName);
    expect(environments).toContain(updatedEnvName);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("should return 200 OK and update the environment with environment token (backend token) auth", async () => {
    const environmentName = "environment-1";
    const postAppResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
        environmentName,
      },
    });
    expect(postAppResponse.status).toBe(201);

    const appBody = await postAppResponse.json();
    const appToken = appBody.applicationTokens[0].key as string;
    const envToken = appBody.environmentTokens[0].key as string;

    const updatedEnvName = "updated-environment";
    const patchResponse = await helper.executePatchRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: envToken,
      body: {
        envName: updatedEnvName,
        description: "updated description",
      },
    });
    expect(patchResponse.status).toBe(200);

    const environment = (await helper.getEnvironmentFromDbByName(
      updatedEnvName,
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
      description: "updated description",
      entities: [],
      name: updatedEnvName,
    });

    const environments = await helper.getEnvironmentsFromAppName(appName);
    expect(environments).toContain(updatedEnvName);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteResponse.status).toBe(200);
  });
});
