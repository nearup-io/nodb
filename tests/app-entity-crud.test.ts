import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TestApplicationStarter } from "./helpers/test-application-starter.ts";
import Application, {
  type Application as AppType,
} from "../src/models/application.model.ts";
import * as R from "ramda";
import Entity, {
  type Entity as EntityType,
} from "../src/models/entity.model.ts";
import Environment, {
  type Environment as EnvironmentType,
} from "../src/models/environment.model.ts";

const getAppFromDbByName = async (appName: string): Promise<AppType | null> => {
  return Application.findOne<AppType>({
    name: appName,
  })
    .select("-__v")
    .lean();
};

const getEntityFromDbById = (id: string): Promise<EntityType | null> => {
  return Entity.findById(id).select("-__v").lean();
};

const getEnvironmentsByAppName = (
  appName: string,
): Promise<EnvironmentType[]> => {
  return Environment.find({ app: appName }).select("-__v").lean();
};

describe("All endpoints used for apps CRUD operations", async () => {
  const helper = new TestApplicationStarter();
  const app = helper.app;
  const jwtToken = await helper.generateJwtToken({
    email: "random@random.com",
    lastProvider: "",
    applications: [],
  });
  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("POST /apps/:appName", async () => {
    const appName = "memes-app";

    describe("Should return 400 BAD REQUEST", async () => {
      test("when appName is too short", async () => {
        const shortAppName = "ap";
        const response = await app.request(`/apps/${shortAppName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            image: "path/to/image.jpg",
            description: "Memes app",
          }),
        });
        expect(response.status).toBe(400);
      });

      test("when appName contains invalid characters", async () => {
        const faultyAppName = "app_?test";
        const response = await app.request(`/apps/${faultyAppName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            image: "path/to/image.jpg",
            description: "Memes app",
          }),
        });
        expect(response.status).toBe(400);
      });

      test("when appName already exists", async () => {
        const appName = "app-name";
        const response = await app.request(`/apps/${appName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            image: "path/to/image.jpg",
            description: "Memes app",
          }),
        });

        expect(response.status).toBe(201);

        const response1 = await app.request(`/apps/${appName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            image: "path/to/image.jpg",
            description: "Memes app",
          }),
        });
        expect(response1.status).toBe(400);
        await Application.findOneAndDelete({ name: appName });
      });
    });

    test("Should return 401 UNAUTHORIZED when no token is present", async () => {
      const response = await app.request(`/apps/${appName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: "path/to/image.jpg",
          description: "Memes app",
        }),
      });
      expect(response.status).toBe(401);
    });

    test("Should return 201 OK and create an app", async () => {
      const response = await app.request(`/apps/${appName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          image: "path/to/image.jpg",
          description: "Memes app",
        }),
      });

      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ success: "success" });
      const dbResult = await getAppFromDbByName(appName);
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

      await Application.findOneAndDelete({ name: appName });
    });
  });

  describe("PATCH /apps/:appName", async () => {
    describe("Should return 400 BAD REQUEST", async () => {
      test("when appName prop in body exists and its too short", async () => {
        const shortAppName = "ap";
        const response = await app.request(`/apps/memes-app`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName: shortAppName,
          }),
        });
        expect(response.status).toBe(400);
      });

      test("when appName prop in body exists and contains invalid characters", async () => {
        const faultyAppName = "app_?test";

        const response = await app.request(`/apps/memes-app`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName: faultyAppName,
          }),
        });
        expect(response.status).toBe(400);

        const response1 = await app.request(`/apps/${faultyAppName}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName: "memes-app",
          }),
        });
        expect(response1.status).toBe(400);
      });

      test("when appName prop in body exists and it's the same as the existing appName", async () => {
        const appName = "testApp";
        const response = await app.request(`/apps/${appName}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName,
          }),
        });
        expect(response.status).toBe(400);
      });
    });

    test("Should return 404 NOT FOUND and return proper body when app is not found", async () => {
      const appName = "random-app";
      const patchResponse = await app.request(`/apps/${appName}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          appName: "new-app-name",
          description: "new description",
          image: "path/to/image-new.jpg",
        }),
      });
      expect(patchResponse.status).toBe(404);
      expect(await patchResponse.json()).toEqual({ found: false });
    });

    test("Should return 200 OK and update app props in db properly", async () => {
      const appName = "random-app";
      const postResponse = await app.request(`/apps/${appName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          image: "path/to/image.jpg",
          description: "some description",
        }),
      });
      expect(postResponse.status).toBe(201);

      const patchResponse = await app.request(`/apps/${appName}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          appName: "new-app-name",
          description: "new description",
          image: "path/to/image-new.jpg",
        }),
      });
      expect(patchResponse.status).toBe(200);
      expect(await patchResponse.json()).toEqual({ found: true });
      const dbResult = await getAppFromDbByName("new-app-name");
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

      await Application.findOneAndDelete({ name: "new-app-name" });
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

    const jwtForGetRequests = await helper.generateJwtToken({
      email: "newJwt@test.com",
      lastProvider: "",
      applications: [],
    });
    beforeAll(async () => {
      for (const { name, ...otherProps } of apps) {
        const postResponse = await app.request(`/apps/${name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtForGetRequests,
          },
          body: JSON.stringify(otherProps),
        });
        expect(postResponse.status).toBe(201);
      }
    });

    afterAll(async () => {
      await Application.deleteMany({ name: { $in: apps.map((x) => x.name) } });
    });

    describe("GET /apps/all", async () => {
      test("Should return 200 OK and all users apps", async () => {
        const response = await app.request(`/apps/all`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtForGetRequests,
          },
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
        const response = await app.request(`/apps/all`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: await helper.generateJwtToken({
              email: "test@test.com",
              lastProvider: "",
              applications: [],
            }),
          },
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual([]);
      });
    });

    describe("GET /apps/:appName", () => {
      test("Should return 404 NOT FOUND for an app that does not exist", async () => {
        const response = await app.request(`/apps/none-existing-app`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtForGetRequests,
          },
        });
        expect(response.status).toBe(404);
      });

      test("Should return 200 OK and found app", async () => {
        const response = await app.request(`/apps/${apps[0].name}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtForGetRequests,
          },
        });
        expect(response.status).toBe(200);
      });
    });
  });

  describe("DELETE /apps/:appName", async () => {
    const jwtForDeleteRequests = await helper.generateJwtToken({
      email: "delete@test.com",
      lastProvider: "",
      applications: [],
    });

    test("should return 200 OK {found: false} when app is not found", async () => {
      const response = await app.request(`/apps/not-found-name`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtForDeleteRequests,
        },
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

      const postResponse = await app.request(`/apps/${appForDeletion.name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtForDeleteRequests,
        },
        body: JSON.stringify(R.omit(["name"], appForDeletion)),
      });
      expect(postResponse.status).toBe(201);

      const environmentName = "environment";
      const envResponse = await app.request(
        `/apps/${appForDeletion.name}/${environmentName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtForDeleteRequests,
          },
          body: JSON.stringify({
            description: "This is a staging environment",
          }),
        },
      );
      expect(envResponse.status).toBe(201);

      const entityName = "todo";
      const entityResponse = await app.request(
        `/apps/${appForDeletion.name}/${environmentName}/${entityName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtForDeleteRequests,
          },
          body: JSON.stringify([
            { title: "Grocery Shopping", completed: false, priority: "medium" },
          ]),
        },
      );
      expect(entityResponse.status).toBe(201);
      const [createdEntityId] = (
        (await entityResponse.json()) as { ids: string[] }
      ).ids;

      const subEntityName = "subentity";
      const subEntityResponse = await app.request(
        `/apps/${appForDeletion.name}/${environmentName}/${entityName}/${createdEntityId}/${subEntityName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtForDeleteRequests,
          },
          body: JSON.stringify([{ prop: "randomProp", prop2: "randomProp2" }]),
        },
      );
      expect(subEntityResponse.status).toBe(201);
      const [createdSubEntityId] = (
        (await subEntityResponse.json()) as { ids: string[] }
      ).ids;

      const response = await app.request(`/apps/${appForDeletion.name}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtForDeleteRequests,
        },
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ found: true });

      expect(await getEntityFromDbById(createdEntityId)).toBeNull();
      expect(await getEntityFromDbById(createdSubEntityId)).toBeNull();

      const environmentsForApp = await getEnvironmentsByAppName(
        appForDeletion.name,
      );
      expect(environmentsForApp).toBeArrayOfSize(0);
    });
  });
});
