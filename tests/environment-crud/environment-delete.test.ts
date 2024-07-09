import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("DELETE /apps/:appName/:envName", async () => {
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

  describe("should return 401", async () => {
    test("when no backend token or JWT token is provided", async () => {
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

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/dev`,
      });
      expect(deleteResponse.status).toBe(401);

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });

    test("when app token (backend token) does not have permissions for the application where it needs to delete the environment", async () => {
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

      const environmentName = "environment";
      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        backendToken: appToken,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(environmentResponse.status).toBe(201);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}-1/${environmentName}`,
        backendToken: appToken,
      });

      expect(deleteResponse.status).toBe(401);

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });

    test("when environment token (backend token) does not have permissions for the current environment that it's trying to delete", async () => {
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

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/dev2`,
        backendToken: envToken,
      });

      expect(deleteResponse.status).toBe(401);

      const deleteAppResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteAppResponse.status).toBe(200);
    });
  });

  test("should return 200 OK and found false when environment is not found", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}/not-existing-environment`,
      jwtToken,
    });

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ found: false });

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and found true when environment is deleted successfully with jwt auth", async () => {
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

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken,
    });

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ found: true });
    expect(await helper.getEnvironmentFromDbByName(environmentName)).toBeNull();

    const environmentsByApp = await helper.getEnvironmentsFromAppName(appName);
    expect(environmentsByApp).not.toContain(environmentName);

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and found true when environment is deleted successfully with application token (backend token)", async () => {
    const environmentName = "environment";

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
    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: appToken,
    });

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ found: true });
    expect(await helper.getEnvironmentFromDbByName(environmentName)).toBeNull();

    const environmentsByApp = await helper.getEnvironmentsFromAppName(appName);
    expect(environmentsByApp).not.toContain(environmentName);

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and found true when environment is deleted successfully with environment token (backend token)", async () => {
    const environmentName = "environment";

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
    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}`,
      backendToken: envToken,
    });

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ found: true });
    expect(await helper.getEnvironmentFromDbByName(environmentName)).toBeNull();

    const environmentsByApp = await helper.getEnvironmentsFromAppName(appName);
    expect(environmentsByApp).not.toContain(environmentName);

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });
});
