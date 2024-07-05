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
        jwtToken: jwtToken,
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
        jwtToken: jwtToken,
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
        jwtToken: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });

      expect(response.status).toBe(201);

      const response1 = await helper.executePostRequest({
        url: `/apps/${duplicateAppName}`,
        jwtToken: jwtToken,
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
      jwtToken: jwtToken,
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
    const { id, environments, tokens, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    expect(tokens).toStrictEqual(body.tokens);
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
    expect(environment.tokens).toStrictEqual(body.tokens);
    await helper.deleteAppByName(appName);
  });

  test("Should return 201 OK and create an app with clerk's JWT token", async () => {
    const secondAppName = "second-app";
    const response = await helper.executePostRequest({
      url: `/apps/${secondAppName}`,
      jwtToken: jwtToken,
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
    const { id, environments, tokens, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    expect(tokens).toStrictEqual(body.tokens);
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
    expect(environment.tokens).toStrictEqual(body.tokens);

    await helper.deleteAppByName(secondAppName);
  });

  test("Should return 201 OK and create an app with backend token but receive an new token", async () => {
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
      tokens: Token[];
    };

    const [token] = firstAppBody.tokens as Token[];
    const fourthAppName = "fourth-app";
    const secondAppResponse = await helper.executePostRequest({
      url: `/apps/${fourthAppName}`,
      backendToken: token.key,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
        environmentName: "fourth-app-environment",
        environmentDescription: "Environment description",
      },
    });

    expect(secondAppResponse.status).toBe(201);
    const body = (await secondAppResponse.json()) as {
      applicationName: string;
      environmentName: string;
      tokens: Token[];
    };

    expect(Object.keys(body).sort()).toStrictEqual([
      "applicationName",
      "environmentName",
      "tokens",
    ]);

    expect(body.applicationName).toBe(fourthAppName);
    expect(body.environmentName).toBe("fourth-app-environment");
    expect(body.tokens.length).toBe(1);
    const [firstToken] = body.tokens;
    expect(Object.keys(firstToken).sort()).toStrictEqual(["key", "permission"]);
    expect(typeof firstToken.key).toBe("string");
    expect(firstToken.permission).toBe("ALL");
    const dbResult = await helper.getAppFromDbByName(fourthAppName);
    expect(dbResult).not.toBeNull();
    const { id, environments, tokens, ...otherProps } = dbResult!;
    expect(id).not.toBeUndefined();
    expect(tokens).toStrictEqual(body.tokens);
    // one environment is automatically created
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      description: "Memes app",
      image: "path/to/image.jpg",
      name: fourthAppName,
    });

    const [environment] = environments;
    expect(environment.name).toBe("fourth-app-environment");
    expect(environment.tokens).toStrictEqual(body.tokens);
    expect(environment.tokens[0].key).not.toEqual(token.key);

    await helper.deleteAppByName(thirdAppName);
    await helper.deleteAppByName(fourthAppName);
  });
});
