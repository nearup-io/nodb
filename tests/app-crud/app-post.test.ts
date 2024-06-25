import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("POST /apps/:appName", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";
  const appName = "memes-app";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("Should return 400 BAD REQUEST", async () => {
    test("when appName is too short", async () => {
      const shortAppName = "ap";
      const response = await helper.executePostRequest({
        url: `/apps/${shortAppName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(400);
    });

    test("when appName contains invalid characters", async () => {
      const faultyAppName = "app_?test";
      const response = await helper.executePostRequest({
        url: `/apps/${faultyAppName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response.status).toBe(400);
    });

    test("when appName already exists", async () => {
      const duplicateAppName = "app-name";
      const response = await helper.executePostRequest({
        url: `/apps/${duplicateAppName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });

      expect(response.status).toBe(201);

      const response1 = await helper.executePostRequest({
        url: `/apps/${duplicateAppName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response1.status).toBe(400);
      await helper.deleteAppByName(duplicateAppName);
    });
  });

  test("Should return 401 UNAUTHORIZED when no token is present", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(401);
  });

  test("Should return 201 OK and create an app", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: "success" });
    const dbResult = await helper.getAppFromDbByName(appName);
    expect(dbResult).not.toBeNull();
    const { id, environments, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    // one environment is automatically created
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      description: "Memes app",
      image: "path/to/image.jpg",
      name: appName,
    });
    await helper.deleteAppByName(appName);
  });
});
