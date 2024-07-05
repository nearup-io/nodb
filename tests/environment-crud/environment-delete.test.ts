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

  test("should return 200 OK and found false when environment is not found", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}/not-existing-environment`,
      jwtToken: jwtToken,
    });

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ found: false });

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and found true when environment is deleted successfully", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const environmentName = "environment";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
    });

    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ found: true });
    expect(await helper.getEnvironmentFromDbByName(environmentName)).toBeNull();

    const environmentsByApp = await helper.getEnvironmentsFromAppName(appName);
    expect(environmentsByApp).not.toContain(environmentName);

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });
});
