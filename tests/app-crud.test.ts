import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TestApplicationHelper } from "./helpers/test-application-helper.ts";
import { type Application as AppType } from "../src/models/application.model.ts";
import * as R from "ramda";
import {
  defaultTestUser,
  testUser2,
  testUser3,
  testUser4,
} from "./helpers/testUsers.ts";

describe("All endpoints used for apps CRUD operations", async () => {
  const helper = new TestApplicationHelper();
  let jwtToken = "";
  beforeAll(async () => {
    jwtToken = await helper.insertUser(defaultTestUser);
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("POST /apps/:appName", async () => {
    const appName = "memes-app";

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
      const { _id, environments, ...otherProps } = dbResult!;
      expect(_id).not.toBeUndefined();
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

  describe("PATCH /apps/:appName", async () => {
    describe("Should return 400 BAD REQUEST", async () => {
      test("when appName prop in body exists and its too short", async () => {
        const shortAppName = "ap";
        const response = await helper.executePatchRequest({
          url: `/apps/memes-app`,
          token: jwtToken,
          body: {
            appName: shortAppName,
          },
        });
        expect(response.status).toBe(400);
      });

      test("when appName prop in body exists and contains invalid characters", async () => {
        const faultyAppName = "app_?test";

        const response = await helper.executePatchRequest({
          url: `/apps/memes-app`,
          token: jwtToken,
          body: {
            appName: faultyAppName,
          },
        });
        expect(response.status).toBe(400);

        const response1 = await helper.executePatchRequest({
          url: `/apps/${faultyAppName}`,
          token: jwtToken,
          body: {
            appName: "memes-app",
          },
        });
        expect(response1.status).toBe(400);
      });

      test("when appName prop in body exists and it's the same as the existing appName", async () => {
        const appName = "testApp";

        const response = await helper.executePatchRequest({
          url: `/apps/${appName}`,
          token: jwtToken,
          body: {
            appName,
          },
        });
        expect(response.status).toBe(400);
      });
    });

    test("Should return 404 NOT FOUND and return proper body when app is not found", async () => {
      const appName = "random-app";
      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          appName: "new-app-name",
          description: "new description",
          image: "path/to/image-new.jpg",
        },
      });

      expect(patchResponse.status).toBe(404);
      expect(await patchResponse.json()).toEqual({ found: false });
    });

    test("Should return 200 OK and update app props in db properly", async () => {
      const appName = "random-app";
      const postResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "some description",
        },
      });
      expect(postResponse.status).toBe(201);

      const patchResponse = await helper.executePatchRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          appName: "new-app-name",
          description: "new description",
          image: "path/to/image-new.jpg",
        },
      });

      expect(patchResponse.status).toBe(200);
      expect(await patchResponse.json()).toEqual({ found: true });
      const dbResult = await helper.getAppFromDbByName("new-app-name");
      expect(dbResult).not.toBeNull();
      const { _id, environments, ...otherProps } = dbResult!;
      expect(_id).not.toBeUndefined();
      // one environment is automatically created
      expect(environments).toBeArray();
      expect(environments.length).toEqual(1);
      expect(otherProps).toEqual({
        name: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      });

      await helper.deleteAppByName("new-app-name");
    });
  });

  describe("GET requests", async () => {
    const apps: Omit<AppType, "_id" | "environments">[] = [
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

    const jwtForGetRequests = await helper.insertUser(testUser2);
    beforeAll(async () => {
      for (const { name, ...otherProps } of apps) {
        const postResponse = await helper.executePostRequest({
          url: `/apps/${name}`,
          token: jwtForGetRequests,
          body: otherProps,
        });

        expect(postResponse.status).toBe(201);
      }
    });

    afterAll(async () => {
      await helper.deleteAppsByNames(apps.map((x) => x.name));
    });

    describe("GET /apps/all", async () => {
      test("Should return 200 OK and all users apps", async () => {
        const response = await helper.executeGetRequest({
          url: "/apps/all",
          token: jwtForGetRequests,
        });
        expect(response.status).toBe(200);

        const entities = (await response.json()) as any[];

        const [first] = entities;
        expect(first.environments).toBeArray();

        const [firstEnvironment] = first.environments;

        expect(R.keys(firstEnvironment)).toEqual([
          "name",
          "tokens",
          "entities",
        ]);

        expect(firstEnvironment.entities).toBeArray();
        expect(firstEnvironment.name).toBeString();
        expect(firstEnvironment.tokens).toBeArray();

        const [firstToken] = firstEnvironment.tokens;
        expect(firstToken.key).toBeString();
        expect(firstToken.permission).toBeString();

        expect(
          entities.map((entity) => R.omit(["environments"], entity)),
        ).toEqual(apps);
      });

      test("Should return 200 OK and empty array when the user does not have any apps", async () => {
        const token = await helper.insertUser(testUser3);

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
          token: jwtForGetRequests,
        });
        expect(response.status).toBe(404);
      });

      test("Should return 200 OK and found app", async () => {
        const response = await helper.executeGetRequest({
          url: `/apps/${apps[0].name}`,
          token: jwtForGetRequests,
        });

        expect(response.status).toBe(200);
      });
    });
  });

  describe("DELETE /apps/:appName", async () => {
    const jwtForDeleteRequests = await helper.insertUser(testUser4);

    test("should return 200 OK {found: false} when app is not found", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/apps/not-found-name`,
        token: jwtForDeleteRequests,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ found: false });
    });

    test("should remove all environments, entities and remove the app from the user", async () => {
      const appForDeletion: Omit<AppType, "_id" | "environments"> = {
        name: "app-name-1",
        image: "path/to/image-1.jpg",
        description: "description 1",
      };

      const postResponse = await helper.executePostRequest({
        url: `/apps/${appForDeletion.name}`,
        token: jwtForDeleteRequests,
        body: R.omit(["name"], appForDeletion),
      });

      expect(postResponse.status).toBe(201);

      const environmentName = "environment";
      const envResponse = await helper.executePostRequest({
        url: `/apps/${appForDeletion.name}/${environmentName}`,
        token: jwtForDeleteRequests,
        body: {
          description: "This is a staging environment",
        },
      });
      expect(envResponse.status).toBe(201);
      const entityName = "todo";
      const entityResponse = await helper.executePostRequest({
        url: `/apps/${appForDeletion.name}/${environmentName}/${entityName}`,
        token: jwtForDeleteRequests,
        body: [
          { title: "Grocery Shopping", completed: false, priority: "medium" },
        ],
      });
      expect(entityResponse.status).toBe(201);
      const [createdEntityId] = (
        (await entityResponse.json()) as { ids: string[] }
      ).ids;

      const subEntityName = "subentity";
      const subEntityResponse = await helper.executePostRequest({
        url: `/apps/${appForDeletion.name}/${environmentName}/${entityName}/${createdEntityId}/${subEntityName}`,
        token: jwtForDeleteRequests,
        body: [{ prop: "randomProp", prop2: "randomProp2" }],
      });
      expect(subEntityResponse.status).toBe(201);
      const [createdSubEntityId] = (
        (await subEntityResponse.json()) as { ids: string[] }
      ).ids;

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appForDeletion.name}`,
        token: jwtForDeleteRequests,
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ found: true });

      expect(await helper.getEntityFromDbById(createdEntityId)).toBeNull();
      expect(await helper.getEntityFromDbById(createdSubEntityId)).toBeNull();

      const environmentsForApp = await helper.getEnvironmentsFromDbByAppName(
        appForDeletion.name,
      );
      expect(environmentsForApp).toBeArrayOfSize(0);
      expect(
        await helper.getUserAppsFromDbByEmail("delete@test.com"),
      ).toBeArrayOfSize(0);
    });
  });
});
