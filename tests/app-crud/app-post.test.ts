import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";
import { type Token } from "../../src/models/environment.model";

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
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });

      expect(response.status).toBe(201);

      const response1 = await helper.executePostRequest({
        url: `/apps/${duplicateAppName}`,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(response1.status).toBe(400);
      await helper.deleteAppByName(duplicateAppName);
    });
  });

  test("Should return 201 CREATED when no token is present and return app, environment and tokens", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      applicationName: string;
      environmentName: string;
      tokens: Token[];
    };

    expect(Object.keys(body).sort()).toStrictEqual([
      "applicationName",
      "environmentName",
      "tokens",
    ]);

    expect(body.applicationName).toBe(appName);
    expect(body.environmentName).toBe("dev"); // default environment being created
    expect(body.tokens.length).toBe(1);
    const [firstToken] = body.tokens;
    expect(Object.keys(firstToken).sort()).toStrictEqual(["key", "permission"]);
    expect(typeof firstToken.key).toBe("string");
    expect(firstToken.permission).toBe("ALL");
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

  test("Should return 201 OK and create an app", async () => {
    const secondAppName = "second-app";
    const response = await helper.executePostRequest({
      url: `/apps/${secondAppName}`,
      token: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      applicationName: string;
      environmentName: string;
      tokens: Token[];
    };

    expect(Object.keys(body).sort()).toStrictEqual([
      "applicationName",
      "environmentName",
      "tokens",
    ]);

    expect(body.applicationName).toBe(secondAppName);
    expect(body.environmentName).toBe("dev"); // default environment being created
    expect(body.tokens.length).toBe(1);
    const [firstToken] = body.tokens;
    expect(Object.keys(firstToken).sort()).toStrictEqual(["key", "permission"]);
    expect(typeof firstToken.key).toBe("string");
    expect(firstToken.permission).toBe("ALL");
    const dbResult = await helper.getAppFromDbByName(secondAppName);
    expect(dbResult).not.toBeNull();
    const { id, environments, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    // one environment is automatically created
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      description: "Memes app",
      image: "path/to/image.jpg",
      name: secondAppName,
    });
    await helper.deleteAppByName(secondAppName);
  });
});
