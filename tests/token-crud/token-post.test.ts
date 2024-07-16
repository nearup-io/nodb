import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";
import { type Token } from "../../src/models/token.model";

describe("Tokens post endpoints", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";
  let applicationToken = "";
  let environmentToken = "";
  const appName = "memes-app";
  const envName = "env-name";
  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
    const postResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken,
      body: {
        image: "randomImage.jpg",
        environmentName: envName,
      },
    });
    expect(postResponse.status).toBe(201);
    const appResponseBody = (await postResponse.json()) as {
      applicationName: string;
      environmentName: string;
      applicationTokens: Token[];
      environmentTokens: Token[];
    };

    applicationToken = appResponseBody.applicationTokens[0].key;
    environmentToken = appResponseBody.environmentTokens[0].key;
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("POST /tokens/:appName", () => {
    describe("Should return 400 BAD REQUEST", async () => {
      test("when permission prop is missing from body", async () => {
        const response = await helper.executePostRequest({
          url: `/tokens/${appName}`,
          jwtToken,
          body: {},
        });
        expect(response.status).toBe(400);
      });

      test("when permission is invalid value", async () => {
        const response = await helper.executePostRequest({
          url: `/tokens/${appName}`,
          jwtToken,
          body: {
            permission: "RANDOM",
          },
        });
        expect(response.status).toBe(400);
      });
    });

    test("Should return 401 UNAUTHORIZED when backend token or jwt token are missing", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(401);
    });

    test("Should return 403 FORBIDDEN when you don't have permissions towards the application (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/random-app`,
        backendToken: applicationToken,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(403);
    });

    test("Should return 403 FORBIDDEN when you try to create an app token with an env token (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        backendToken: environmentToken,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(403);
    });

    test("Should return 201 CREATED and correct response body with jwt token", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        jwtToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(Object.keys(body).sort()).toStrictEqual(
        ["appName", "permission", "token"].sort(),
      );
      expect(body.appName).toEqual(appName);
      expect(body.permission).toEqual("READ_ONLY");
      expect(body.token).toBeString();
      expect(body.token).not.toEqual(applicationToken);

      const tokenObj = await helper.getTokenByToken(body.token);
      expect(tokenObj!.key).toEqual(body.token);
      expect(tokenObj!.permission).toEqual("READ_ONLY");
      expect(tokenObj!.environmentId).toBeNull();
      expect(tokenObj!.applicationId).toBeString();
    });

    test("Should return 201 CREATED and correct response body with application token (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        backendToken: applicationToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(Object.keys(body).sort()).toStrictEqual(
        ["appName", "permission", "token"].sort(),
      );
      expect(body.appName).toEqual(appName);
      expect(body.permission).toEqual("READ_ONLY");
      expect(body.token).toBeString();
      expect(body.token).not.toEqual(applicationToken);

      const tokenObj = await helper.getTokenByToken(body.token);
      expect(tokenObj!.key).toEqual(body.token);
      expect(tokenObj!.permission).toEqual("READ_ONLY");
      expect(tokenObj!.environmentId).toBeNull();
      expect(tokenObj!.applicationId).toBeString();
    });
  });

  describe("POST /tokens/:appName/:envName", () => {
    describe("Should return 400 BAD REQUEST", async () => {
      test("when permission prop is missing from body", async () => {
        const response = await helper.executePostRequest({
          url: `/tokens/${appName}/${envName}`,
          jwtToken,
          body: {},
        });
        expect(response.status).toBe(400);
      });

      test("when permission is invalid value", async () => {
        const response = await helper.executePostRequest({
          url: `/tokens/${appName}/${envName}`,
          jwtToken,
          body: {
            permission: "RANDOM",
          },
        });
        expect(response.status).toBe(400);
      });
    });

    test("Should return 401 UNAUTHORIZED when backend token or jwt token are missing", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}/${envName}`,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(401);
    });

    test("Should return 403 FORBIDDEN when you don't have permissions towards the environment (backend token)", async () => {
      const envResponse = await helper.executePostRequest({
        url: `/apps/${appName}/random-env`,
        jwtToken,
        body: {
          description: "some description",
        },
      });
      expect(envResponse.status).toBe(201);

      const response = await helper.executePostRequest({
        url: `/tokens/${appName}/random-env`,
        backendToken: environmentToken,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(403);
    });

    test("Should return 404 NOT FOUND when environment does not exist", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}/not-existing-environment`,
        jwtToken,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(404);
    });

    test("Should return 201 CREATED and correct response body with jwt token", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}/${envName}`,
        jwtToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(Object.keys(body).sort()).toStrictEqual(
        ["appName", "envName", "permission", "token"].sort(),
      );
      expect(body.appName).toEqual(appName);
      expect(body.envName).toEqual(envName);
      expect(body.permission).toEqual("READ_ONLY");
      expect(body.token).toBeString();
      expect(body.token).not.toEqual(environmentToken);

      const tokenObj = await helper.getTokenByToken(body.token);
      expect(tokenObj!.key).toEqual(body.token);
      expect(tokenObj!.permission).toEqual("READ_ONLY");
      expect(tokenObj!.environmentId).toBeString();
      expect(tokenObj!.applicationId).toBeNull();
    });

    test("Should return 201 CREATED and correct response body with environment token (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}/${envName}`,
        backendToken: environmentToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(Object.keys(body).sort()).toStrictEqual(
        ["appName", "envName", "permission", "token"].sort(),
      );
      expect(body.appName).toEqual(appName);
      expect(body.envName).toEqual(envName);
      expect(body.permission).toEqual("READ_ONLY");
      expect(body.token).toBeString();
      expect(body.token).not.toEqual(environmentToken);

      const tokenObj = await helper.getTokenByToken(body.token);
      expect(tokenObj!.key).toEqual(body.token);
      expect(tokenObj!.permission).toEqual("READ_ONLY");
      expect(tokenObj!.environmentId).toBeString();
      expect(tokenObj!.applicationId).toBeNull();
    });

    test("Should return 201 CREATED and correct response body with application token (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}/${envName}`,
        backendToken: applicationToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(response.status).toBe(201);
      const body = await response.json();

      expect(Object.keys(body).sort()).toStrictEqual(
        ["appName", "envName", "permission", "token"].sort(),
      );
      expect(body.appName).toEqual(appName);
      expect(body.envName).toEqual(envName);
      expect(body.permission).toEqual("READ_ONLY");
      expect(body.token).toBeString();
      expect(body.token).not.toEqual(environmentToken);

      const tokenObj = await helper.getTokenByToken(body.token);
      expect(tokenObj!.key).toEqual(body.token);
      expect(tokenObj!.permission).toEqual("READ_ONLY");
      expect(tokenObj!.environmentId).toBeString();
      expect(tokenObj!.applicationId).toBeNull();
    });
  });
});
