import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";
import { type Token } from "../../src/models/token.model";

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
        jwtToken,
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
        jwtToken,
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
        jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });

      expect(response.status).toBe(201);

      const response1 = await helper.executePostRequest({
        url: `/apps/${duplicateAppName}`,
        jwtToken,
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
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);

    const body = (await response.json()) as {
      applicationName: string;
      environmentName: string;
      applicationTokens: Token[];
      environmentTokens: Token[];
    };

    expect(Object.keys(body).sort()).toStrictEqual(
      [
        "applicationName",
        "environmentName",
        "applicationTokens",
        "environmentTokens",
      ].sort(),
    );

    expect(body.applicationName).toBe(appName);
    expect(body.environmentName).toBe("dev"); // default environment being created
    expect(body.applicationTokens.length).toBe(1);
    const [firstAppToken] = body.applicationTokens;
    expect(Object.keys(firstAppToken).sort()).toStrictEqual(
      ["key", "permission"].sort(),
    );
    expect(firstAppToken.key).toBeString();
    expect(firstAppToken.permission).toBe("ALL");

    expect(body.environmentTokens.length).toBe(1);
    const [firstEnvToken] = body.environmentTokens;
    expect(Object.keys(firstEnvToken).sort()).toStrictEqual([
      "key",
      "permission",
    ]);
    expect(firstEnvToken.key).toBeString();
    expect(firstEnvToken.permission).toBe("ALL");

    expect(firstAppToken.key).not.toEqual(firstEnvToken.key);

    const dbResult = await helper.getAppFromDbByName(appName);
    expect(dbResult).not.toBeNull();
    const { id, environments, tokens, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    expect(tokens).toStrictEqual(body.applicationTokens);
    // one environment is automatically created
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      description: "Memes app",
      image: "path/to/image.jpg",
      name: appName,
    });
    const [environment] = environments;
    expect(environment.name).toBe("dev"); // default env
    expect(environment.tokens).toStrictEqual(body.environmentTokens);
    await helper.deleteAppByName(appName);
  });

  test("Should return 201 OK and create an app with clerk's JWT token", async () => {
    const secondAppName = "second-app";
    const response = await helper.executePostRequest({
      url: `/apps/${secondAppName}`,
      jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      applicationName: string;
      environmentName: string;
      applicationTokens: Token[];
      environmentTokens: Token[];
    };

    expect(Object.keys(body).sort()).toStrictEqual(
      [
        "applicationName",
        "environmentName",
        "applicationTokens",
        "environmentTokens",
      ].sort(),
    );

    expect(body.applicationName).toBe(secondAppName);
    expect(body.environmentName).toBe("dev"); // default environment being created
    expect(body.applicationTokens.length).toBe(1);
    const [firstAppToken] = body.applicationTokens;
    expect(Object.keys(firstAppToken).sort()).toStrictEqual(
      ["key", "permission"].sort(),
    );
    expect(firstAppToken.key).toBeString();
    expect(firstAppToken.permission).toBe("ALL");

    expect(body.environmentTokens.length).toBe(1);
    const [firstEnvToken] = body.environmentTokens;
    expect(Object.keys(firstEnvToken).sort()).toStrictEqual([
      "key",
      "permission",
    ]);
    expect(firstEnvToken.key).toBeString();
    expect(firstEnvToken.permission).toBe("ALL");

    expect(firstAppToken.key).not.toEqual(firstEnvToken.key);

    const dbResult = await helper.getAppFromDbByName(secondAppName);
    expect(dbResult).not.toBeNull();
    const { id, environments, tokens, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    expect(tokens).toStrictEqual(body.applicationTokens);
    // one environment is automatically created
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      description: "Memes app",
      image: "path/to/image.jpg",
      name: secondAppName,
    });

    const [environment] = environments;
    expect(environment.name).toBe("dev"); // default env
    expect(environment.tokens).toStrictEqual(body.environmentTokens);

    await helper.deleteAppByName(secondAppName);
  });

  test("Should return 201 OK and create an app with backend token but receive a new token", async () => {
    const thirdAppName = "third-app";
    const firstAppResponse = await helper.executePostRequest({
      url: `/apps/${thirdAppName}`,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(firstAppResponse.status).toBe(201);
    const firstAppBody = (await firstAppResponse.json()) as {
      applicationName: string;
      environmentName: string;
      applicationTokens: Token[];
      environmentTokens: Token[];
    };

    const [appToken] = firstAppBody.applicationTokens;
    const [environmentToken] = firstAppBody.environmentTokens;

    const fourthApp = "fourth-app";
    const secondAppResponse = await helper.executePostRequest({
      url: `/apps/${fourthApp}`,
      backendToken: appToken.key,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
        envName: "fourth-app-environment",
        envDescription: "Environment description",
      },
    });

    expect(secondAppResponse.status).toBe(201);

    const appCreatedWithAppToken = (await secondAppResponse.json()) as {
      applicationName: string;
      environmentName: string;
      applicationTokens: Token[];
      environmentTokens: Token[];
    };

    const [firstAppToken] = appCreatedWithAppToken.applicationTokens;
    expect(firstAppToken.key).not.toEqual(appToken.key);

    const fifthAppName = "fifth-app";
    const thirdAppResponse = await helper.executePostRequest({
      url: `/apps/${fifthAppName}`,
      backendToken: environmentToken.key,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
        envName: "fifth-app-environment",
        envDescription: "Environment description",
      },
    });

    expect(thirdAppResponse.status).toBe(201);

    const appCreatedWithEnvToken = (await thirdAppResponse.json()) as {
      applicationName: string;
      environmentName: string;
      applicationTokens: Token[];
      environmentTokens: Token[];
    };

    const [firstEnvToken] = appCreatedWithEnvToken.environmentTokens;
    expect(firstEnvToken.key).not.toEqual(appToken.key);

    await helper.deleteAppByName(thirdAppName);
    await helper.deleteAppByName(fifthAppName);
    await helper.deleteAppByName(fourthApp);
  });
});
