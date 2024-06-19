import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongodbTestApplicationHelper } from "./helpers/mongodb-test-application-helper.ts";
import { type Environment as EnvironmentType } from "../src/models/environment.model.ts";
import * as R from "ramda";
import { defaultTestUser } from "./helpers/testUsers.ts";

describe("Environment entity CRUD", async () => {
  const helper = new MongodbTestApplicationHelper();
  let jwtToken = "";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("POST /apps/:appName/:envName", async () => {
    const appName = "test-app-name";

    test("should return 400 BAD REQUEST when environment for that app already exists", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
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
        token: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(firstEnvironmentResponse.status).toBe(201);

      // duplicate environment
      const secondEnvironmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });

      // expectations
      expect(secondEnvironmentResponse.status).toBe(400);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("should return 201 CREATED and create the environment for the app", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);
      const environmentName = "environment-1";
      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
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
        token: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });

  describe("PATCH /apps/:appName/:envName", async () => {
    const appName = "test-app-name";

    test("should return 404 NOT FOUND when the environment does not exist", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
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
        token: jwtToken,
        body: {
          envName: "new-env-name",
          description: "This is a staging environment",
        },
      });
      expect(patchResponse.status).toBe(404);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    describe("should return 400 BAD REQUEST", () => {
      test("when you try to rename the environment to the same name", async () => {
        const response = await helper.executePostRequest({
          url: `/apps/${appName}`,
          token: jwtToken,
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
          token: jwtToken,
          body: {
            envName: environmentName,
            description: "This is a staging environment",
          },
        });
        expect(firstEnvironmentResponse.status).toBe(400);

        const deleteResponse = await helper.executeDeleteRequest({
          url: `/apps/${appName}`,
          token: jwtToken,
        });
        expect(deleteResponse.status).toBe(200);
      });

      test("when no props are passed to be updated", async () => {
        const response = await helper.executePostRequest({
          url: `/apps/${appName}`,
          token: jwtToken,
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
          token: jwtToken,
          body: {
            description: "This is a staging environment",
          },
        });
        expect(firstEnvironmentResponse.status).toBe(201);

        const patchResponse = await helper.executePatchRequest({
          url: `/apps/${appName}/${environmentName}`,

          token: jwtToken,
          body: {},
        });
        expect(patchResponse.status).toBe(400);

        const deleteResponse = await helper.executeDeleteRequest({
          url: `/apps/${appName}`,
          token: jwtToken,
        });
        expect(deleteResponse.status).toBe(200);
      });

      test("when new environment name already exists", async () => {
        const response = await helper.executePostRequest({
          url: `/apps/${appName}`,
          token: jwtToken,
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
          token: jwtToken,
          body: {
            description: "This is a staging environment",
          },
        });
        expect(firstEnvironmentResponse.status).toBe(201);

        const secondEnvironmentName = "environment-2";
        const secondEnvironmentResponse = await helper.executePostRequest({
          url: `/apps/${appName}/${secondEnvironmentName}`,
          token: jwtToken,
          body: {
            description: "This is a staging environment",
          },
        });
        expect(secondEnvironmentResponse.status).toBe(201);

        const patchResponse = await helper.executePatchRequest({
          url: `/apps/${appName}/${environmentName}`,
          token: jwtToken,
          body: { envName: secondEnvironmentName },
        });
        expect(patchResponse.status).toBe(400);

        const deleteResponse = await helper.executeDeleteRequest({
          url: `/apps/${appName}`,
          token: jwtToken,
        });
        expect(deleteResponse.status).toBe(200);
      });
    });

    test("should return 200 OK and update the environment", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);
      const environmentName = "environment-1";
      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(environmentResponse.status).toBe(201);

      const updatedEnvName = "updated-environment";
      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
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
        token: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });

  describe("DELETE /apps/:appName/:envName", async () => {
    const appName = "test-app-name";

    test("should return 200 OK and found false when environment is not found", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/not-existing-environment`,
        token: jwtToken,
      });

      expect(deleteResponse.status).toBe(200);
      expect(await deleteResponse.json()).toEqual({ found: false });

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });

    test("should return 200 OK and found true when environment is deleted successfully", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);
      const environmentName = "environment";
      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(environmentResponse.status).toBe(201);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
      });

      expect(deleteResponse.status).toBe(200);
      expect(await deleteResponse.json()).toEqual({ found: true });
      expect(
        await helper.getEnvironmentFromDbByName(environmentName),
      ).toBeNull();

      const environmentsByApp =
        await helper.getEnvironmentsFromAppName(appName);
      expect(environmentsByApp).not.toContain(environmentName);

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });
  });

  describe("GET /apps/:appName/:envName", async () => {
    const appName = "test-app-name";

    test("should return 404 NOT FOUND when environment is not found", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);

      const getResponse = await helper.executeGetRequest({
        url: `/apps/${appName}/not-existing-environment`,
        token: jwtToken,
      });

      expect(getResponse.status).toBe(404);

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });

    test("should return 200 OK and environment", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(201);
      const environmentName = "environment";
      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(environmentResponse.status).toBe(201);

      const getResponse = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
      });

      expect(getResponse.status).toBe(200);

      const body = (await getResponse.json()) as Omit<EnvironmentType, "app">;

      expect(R.keys(body)).toStrictEqual([
        "id",
        "name",
        "tokens",
        "description",
        "entities",
      ]);

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
        token: jwtToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });
  });
});
