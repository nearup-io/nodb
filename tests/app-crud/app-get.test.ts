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

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);

    for (const { name, ...otherProps } of apps) {
      const postResponse = await helper.executePostRequest({
        url: `/apps/${name}`,
        token: jwtToken,
        body: otherProps,
      });

      expect(postResponse.status).toBe(201);
    }
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

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

  describe("GET /apps/all", async () => {
    test("Should return 200 OK and all users apps", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/all",
        token: jwtToken,
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

    test("Should return 200 OK and empty array when the user does not have any apps", async () => {
      const token = await helper.insertUser(testUser2);

      const response = await helper.executeGetRequest({
        url: "/apps/all",
        token,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });
  });

  describe("GET /apps/:appName", () => {
    test("Should return 404 NOT FOUND for an app that does not exist", async () => {
      const response = await helper.executeGetRequest({
        url: "/apps/none-existing-app",
        token: jwtToken,
      });
      expect(response.status).toBe(404);
    });

    test("Should return 200 OK and found app", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${apps[0].name}`,
        token: jwtToken,
      });

      expect(response.status).toBe(200);
    });
  });
});
