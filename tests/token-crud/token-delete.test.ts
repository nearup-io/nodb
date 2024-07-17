import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";
import { type Token, type TokenPermission } from "../../src/models/token.model";

describe("Tokens delete endpoints", async () => {
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

  describe("DELETE /tokens/:appName/:token", () => {
    test("Should return 401 UNAUTHORIZED when backend token or jwt token are missing", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${applicationToken}`,
      });
      expect(response.status).toBe(401);
    });

    test("Should return 403 FORBIDDEN when you don't have permissions towards the application (backend token)", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/random-app/${applicationToken}`,
        backendToken: applicationToken,
      });
      expect(response.status).toBe(403);
    });

    test("Should return 403 FORBIDDEN when you try to delete an app token with an env token (backend token)", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${applicationToken}`,
        backendToken: environmentToken,
      });
      expect(response.status).toBe(403);
    });

    test("Should return 403 FORBIDDEN when you try to delete with an app token that has READ_ONLY permissions", async () => {
      const postTokenResponse = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        jwtToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(postTokenResponse.status).toBe(201);
      const body = (await postTokenResponse.json()) as {
        token: string;
        permission: TokenPermission;
        appName: string;
        envName: string;
      };

      const token = body.token;
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${token}`,
        backendToken: token,
      });
      expect(response.status).toBe(403);
    });

    test("Should return 200 OK and success false when token does not exist", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/test-token`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toStrictEqual({ success: false });
    });

    test("Should return 200 OK and success true with jwt token", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${applicationToken}`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body).toStrictEqual({ success: true });

      const tokenObj = await helper.getTokenByToken(applicationToken);
      expect(tokenObj).toBeNull();
    });

    test("Should return 200 OK and success true with application token (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        jwtToken,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        token: string;
        permission: TokenPermission;
        appName: string;
        envName: string;
      };

      const token = body.token;

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${token}`,
        jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();

      expect(deleteBody).toStrictEqual({ success: true });

      const tokenObj = await helper.getTokenByToken(token);
      expect(tokenObj).toBeNull();
    });
  });

  describe("DELETE /tokens/:appName/:envName/:token", () => {
    test("Should return 401 UNAUTHORIZED when backend token or jwt token are missing", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/${environmentToken}`,
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

      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/random-env/${environmentToken}`,
        backendToken: environmentToken,
      });
      expect(response.status).toBe(403);
    });

    test("Should return 403 FORBIDDEN when you try to delete with an app token that has READ_ONLY permissions", async () => {
      const postTokenResponse = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        jwtToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(postTokenResponse.status).toBe(201);
      const body = (await postTokenResponse.json()) as {
        token: string;
        permission: TokenPermission;
        appName: string;
        envName: string;
      };

      const token = body.token;
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/${token}`,
        backendToken: token,
      });
      expect(response.status).toBe(403);
    });

    test("Should return 403 FORBIDDEN when you try to delete with an env token that has READ_ONLY permissions", async () => {
      const postTokenResponse = await helper.executePostRequest({
        url: `/tokens/${appName}/${envName}`,
        jwtToken,
        body: {
          permission: "READ_ONLY",
        },
      });
      expect(postTokenResponse.status).toBe(201);
      const body = (await postTokenResponse.json()) as {
        token: string;
        permission: TokenPermission;
        appName: string;
        envName: string;
      };

      const token = body.token;
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/${token}`,
        backendToken: token,
      });
      expect(response.status).toBe(403);
    });

    test("Should return 404 NOT FOUND when environment does not exist", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/not-existing-environment/${environmentToken}`,
        jwtToken,
      });
      expect(response.status).toBe(404);
    });

    test("Should return 200 OK and success false when token does not exist", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/test-token`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      const responseBody = await response.json();
      expect(responseBody).toStrictEqual({ success: false });
    });

    test("Should return 200 OK and success true with jwt token", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/${environmentToken}`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      const body = await response.json();

      expect(body).toStrictEqual({ success: true });

      const tokenObj = await helper.getTokenByToken(environmentToken);
      expect(tokenObj).toBeNull();
    });

    test("Should return 200 OK and success true with environment token (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}/${envName}`,
        jwtToken,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        token: string;
        permission: TokenPermission;
        appName: string;
        envName: string;
      };

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/${body.token}`,
        jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();

      expect(deleteBody).toStrictEqual({ success: true });

      const tokenObj = await helper.getTokenByToken(body.token);
      expect(tokenObj).toBeNull();
    });

    test("Should return 200 OK and success true with application token (backend token)", async () => {
      const response = await helper.executePostRequest({
        url: `/tokens/${appName}`,
        jwtToken,
        body: {
          permission: "ALL",
        },
      });
      expect(response.status).toBe(201);
      const body = (await response.json()) as {
        token: string;
        permission: TokenPermission;
        appName: string;
        envName: string;
      };

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/tokens/${appName}/${envName}/${body.token}`,
        jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
      const deleteBody = await deleteResponse.json();

      expect(deleteBody).toStrictEqual({ success: true });

      const tokenObj = await helper.getTokenByToken(body.token);
      expect(tokenObj).toBeNull();
    });
  });
});
