import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
  testUser2,
} from "../helpers";
import * as R from "ramda";
import { type Application } from "../../src/models/application.model";

describe("App endpoint GET", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  const apps: Omit<Application, "id" | "environments" | "tokens">[] = [
    {
      name: "app-name-1",
      image: "path/to/image-1.jpg",
      description: "description 1",
    },
    {
      name: "app-name-2",
      image: "path/to/image-2.jpg",
      description: "description 2",
    },
    {
      name: "app-name-3",
      image: "path/to/image-3.jpg",
      description: "description 3",
    },
    {
      name: "app-name-4",
      image: "path/to/image-4.jpg",
      description: "description 4",
    },
  ];
  const appWithoutUser: Omit<Application, "id" | "environments" | "tokens"> = {
    name: "app-name-5",
    image: "path/to/image-5.jpg",
    description: "description 5",
  };

  let backendAppToken: string = "";
  let backendEnvToken: string = "";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);

    for (const { name, ...otherProps } of apps) {
      const postResponse = await helper.executePostRequest({
        url: `/apps/${name}`,
        jwtToken: jwtToken,
        body: otherProps,
      });

      expect(postResponse.status).toBe(201);
    }

    const postResponse = await helper.executePostRequest({
      url: `/apps/${appWithoutUser.name}`,
      body: R.omit(["name"], appWithoutUser),
    });
    expect(postResponse.status).toBe(201);
    const body = (await postResponse.json()) as any;
    backendAppToken = body.applicationTokens[0].key as string;
    backendEnvToken = body.environmentTokens[0].key as string;
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("GET /apps/all", async () => {
    test("Should return 401 FORBIDDEN when no JWT token or backend token is provided", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/all",
      });
      expect(response.status).toBe(401);
    });

    test("Should return 200 OK and all users apps", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/all",
        jwtToken: jwtToken,
      });
      expect(response.status).toBe(200);

      const entities = (await response.json()) as any[];

      const [first] = entities;
      const [token] = first.tokens;

      expect(token.key).toBeString();
      expect(token.permission).toBeString();
      expect(first.environments).toBeArray();

      const [firstEnvironment] = first.environments;

      expect(R.keys(firstEnvironment).sort()).toEqual(
        ["name", "tokens", "entities"].sort(),
      );

      expect(firstEnvironment.entities).toBeArray();
      expect(firstEnvironment.name).toBeString();
      expect(firstEnvironment.tokens).toBeArray();

      const [firstToken] = firstEnvironment.tokens;
      expect(firstToken.key).toBeString();
      expect(firstToken.permission).toBeString();

      expect(
        entities.map((entity) => R.omit(["environments", "tokens"], entity)),
      ).toEqual(apps);
    });

    test("Should return 200 OK and empty array when the user does not have any", async () => {
      const token = await helper.insertUser(testUser2);

      const response = await helper.executeGetRequest({
        url: "/apps/all",
        jwtToken: token,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });

    test("Should return 200 OK and only the app the app token (backend token) has permission to", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/all",
        backendToken: backendAppToken,
      });
      expect(response.status).toBe(200);

      const entities = (await response.json()) as any[];
      expect(entities.length).toBe(1);

      const [first] = entities;
      const [token] = first.tokens;

      expect(token.key).toEqual(backendAppToken);
      expect(token.permission).toBeString();
      expect(first.environments).toBeArray();

      const [firstEnvironment] = first.environments;

      expect(R.keys(firstEnvironment).sort()).toEqual(
        ["name", "tokens", "entities"].sort(),
      );

      expect(firstEnvironment.entities).toBeArray();
      expect(firstEnvironment.name).toBeString();
      expect(firstEnvironment.tokens).toBeArray();

      const [firstToken] = firstEnvironment.tokens;
      expect(firstToken.key).toEqual(backendEnvToken);
      expect(firstToken.permission).toBeString();

      expect(
        entities.map((entity) => R.omit(["environments", "tokens"], entity)),
      ).toEqual([appWithoutUser]);
    });

    test("Should return 200 OK and only the app the env token (backend token) has permission to", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/all",
        backendToken: backendEnvToken,
      });
      expect(response.status).toBe(200);

      const entities = (await response.json()) as any[];
      expect(entities.length).toBe(1);

      const [first] = entities;
      const [token] = first.tokens;

      expect(token.key).toEqual(backendAppToken);
      expect(token.permission).toBeString();
      expect(first.environments).toBeArray();

      const [firstEnvironment] = first.environments;

      expect(R.keys(firstEnvironment).sort()).toEqual(
        ["name", "tokens", "entities"].sort(),
      );

      expect(firstEnvironment.entities).toBeArray();
      expect(firstEnvironment.name).toBeString();
      expect(firstEnvironment.tokens).toBeArray();

      const [firstToken] = firstEnvironment.tokens;
      expect(firstToken.key).toEqual(backendEnvToken);
      expect(firstToken.permission).toBeString();

      expect(
        entities.map((entity) => R.omit(["environments", "tokens"], entity)),
      ).toEqual([appWithoutUser]);
    });
  });

  describe("GET /apps/:appName", () => {
    test("Should return 401 FORBIDDEN when no JWT token or backend token is provided", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/all",
      });
      expect(response.status).toBe(401);
    });

    test("Should return 401 FORBIDDEN for app when backend token is not linked to the requested app when backend token is used", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${apps[0].name}`,
        backendToken: backendAppToken,
      });

      expect(response.status).toBe(401);
    });

    test("Should return 404 NOT FOUND for an app that does not exist", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/none-existing-app",
        jwtToken: jwtToken,
      });
      expect(response.status).toBe(404);
    });

    test("Should return 200 OK and found app when jwt auth is used", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${apps[0].name}`,
        jwtToken: jwtToken,
      });

      expect(response.status).toBe(200);

      const app = (await response.json()) as any;

      expect(Object.keys(app).sort()).toStrictEqual(
        ["name", "tokens", "description", "environments", "id", "image"].sort(),
      );
      expect(app.name).toEqual(apps[0].name);
      expect(app.id).toBeString();
      expect(app.image).toBeString();
      const [token] = app.tokens;

      expect(token.key).toBeString();
      expect(token.permission).toBeString();
      expect(app.environments).toBeArray();

      const [firstEnvironment] = app.environments;

      expect(R.keys(firstEnvironment).sort()).toEqual(
        ["id", "description", "name", "tokens", "entities"].sort(),
      );

      expect(firstEnvironment.entities).toBeArray();
      expect(firstEnvironment.name).toBeString();
      expect(firstEnvironment.id).toBeString();
      expect(firstEnvironment.description).toBeString();
      expect(firstEnvironment.tokens).toBeArray();

      const [firstToken] = firstEnvironment.tokens;
      expect(firstToken.key).toBeString();
      expect(firstToken.permission).toBeString();

      expect(R.omit(["id", "environments", "tokens"], app)).toEqual(apps[0]);
    });

    test("Should return 200 OK and found app when app token (backend token) is used", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appWithoutUser.name}`,
        backendToken: backendAppToken,
      });

      expect(response.status).toBe(200);

      const app = (await response.json()) as any;

      expect(Object.keys(app).sort()).toStrictEqual(
        ["name", "tokens", "description", "environments", "id", "image"].sort(),
      );
      expect(app.name).toEqual(appWithoutUser.name);
      expect(app.id).toBeString();
      expect(app.image).toBeString();
      const [token] = app.tokens;

      expect(token.key).toBeString();
      expect(token.permission).toBeString();
      expect(app.environments).toBeArray();

      const [firstEnvironment] = app.environments;

      expect(R.keys(firstEnvironment).sort()).toEqual(
        ["id", "description", "name", "tokens", "entities"].sort(),
      );

      expect(firstEnvironment.entities).toBeArray();
      expect(firstEnvironment.name).toBeString();
      expect(firstEnvironment.id).toBeString();
      expect(firstEnvironment.description).toBeString();
      expect(firstEnvironment.tokens).toBeArray();

      const [firstToken] = firstEnvironment.tokens;
      expect(firstToken.key).toBeString();
      expect(firstToken.permission).toBeString();

      expect(R.omit(["id", "environments", "tokens"], app)).toEqual(
        appWithoutUser,
      );
    });

    test("Should return 200 OK and found app when env token (backend token) is used", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appWithoutUser.name}`,
        backendToken: backendEnvToken,
      });

      expect(response.status).toBe(200);

      const app = (await response.json()) as any;

      expect(Object.keys(app).sort()).toStrictEqual(
        ["name", "tokens", "description", "environments", "id", "image"].sort(),
      );
      expect(app.name).toEqual(appWithoutUser.name);
      expect(app.id).toBeString();
      expect(app.image).toBeString();
      const [token] = app.tokens;

      expect(token.key).toBeString();
      expect(token.permission).toBeString();
      expect(app.environments).toBeArray();

      const [firstEnvironment] = app.environments;

      expect(R.keys(firstEnvironment).sort()).toEqual(
        ["id", "description", "name", "tokens", "entities"].sort(),
      );

      expect(firstEnvironment.entities).toBeArray();
      expect(firstEnvironment.name).toBeString();
      expect(firstEnvironment.id).toBeString();
      expect(firstEnvironment.description).toBeString();
      expect(firstEnvironment.tokens).toBeArray();

      const [firstToken] = firstEnvironment.tokens;
      expect(firstToken.key).toBeString();
      expect(firstToken.permission).toBeString();

      expect(R.omit(["id", "environments", "tokens"], app)).toEqual(
        appWithoutUser,
      );
    });
  });
});
