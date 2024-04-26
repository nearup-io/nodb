import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TestApplicationStarter } from "./helpers/test-application-starter.ts";
import Entity, {
  type Entity as EntityType,
} from "../src/models/entity.model.ts";
import Environment, {
  type Environment as EnvironmentType,
} from "../src/models/environment.model.ts";
import * as R from "ramda";
import { deepEqual } from "assert";

const getEnvironmentsFromDbByName = async (
  name: string,
): Promise<EnvironmentType | null> => {
  return Environment.findOne({ name }).select("-__v").lean();
};

const getEntitiesByIdFromDatabase = async (
  ids: string[],
  sortByProp: string = "model.prop",
): Promise<EntityType[]> => {
  return Entity.find({ id: { $in: ids } })
    .select(["-__v", "-_id"])
    .sort(sortByProp)
    .lean();
};

describe("Entity CRUD operations", async () => {
  const helper = new TestApplicationStarter();
  const jwtToken = await helper.generateJWTTokenAndUser({
    email: "random@random.com",
    lastProvider: "",
    applications: [],
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("POST /apps/:appName/:envName/:entityName", async () => {
    const appName = "memes-app";
    const environmentName = "environment";

    beforeAll(async () => {
      const appResponse = await helper.executePostRequest({
        url: `/apps/${appName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(appResponse.status).toBe(201);

      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}`,
        token: jwtToken,
        body: {
          description: "This is an environment",
        },
      });
      expect(environmentResponse.status).toBe(201);
    });

    // TODO verify later why this fails
    // afterAll(async () => {
    //   const appResponse = await helper.executeDeleteRequest({
    //     url: `/apps/${appName}`,
    //     token: jwtToken,
    //   });
    //   expect(appResponse.status).toBe(201);
    // });

    test("Should return 401 UNAUTHORIZED when no token is present", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}/entityName`,
        body: [],
      });
      expect(response.status).toBe(401);
    });

    describe("Should return 400 BAD REQUEST", () => {
      test("when body is missing or it's not an array", async () => {
        const response = await helper.executePostRequest({
          url: `/apps/${appName}/${environmentName}/entityName`,
          token: jwtToken,
        });
        expect(response.status).toBe(400);

        const response1 = await helper.executePostRequest({
          url: `/apps/${appName}/${environmentName}/entityName`,
          token: jwtToken,
          body: {},
        });
        expect(response1.status).toBe(400);
      });

      test("when url params are not valid", async () => {
        const response = await helper.executePostRequest({
          url: `/apps/${appName}/${environmentName}/entityName/:randomId`,
          token: jwtToken,
          body: [{ prop: "value" }],
        });
        expect(response.status).toBe(400);
      });

      test("when environment does not exist", async () => {
        const response = await helper.executePostRequest({
          url: `/apps/${appName}/not-existing-environment/entityName`,
          token: jwtToken,
          body: [{ prop: "value" }],
        });
        expect(response.status).toBe(400);
      });
    });

    test("should return 201 CREATED and create entity", async () => {
      const entityName = "myEntity";
      const response = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}`,
        token: jwtToken,
        body: [{ prop: 1 }, { prop: 2 }, { prop: 3 }],
      });
      expect(response.status).toBe(201);
      const { ids } = (await response.json()) as { ids: string[] };
      expect(ids).toBeArrayOfSize(3);
      expect(ids.at(0)).toBeString();

      const entities = await getEntitiesByIdFromDatabase(ids);
      expect(R.keys(entities.at(0)!)).toStrictEqual([
        "id",
        "type",
        "ancestors",
        "model",
        "embedding",
      ]);

      const entitiesWithoutId = entities.map((entity) => {
        expect(entity.id).toBeString();
        return R.omit(["id"], entity);
      });

      deepEqual(entitiesWithoutId, [
        {
          ancestors: [],
          embedding: [],
          model: {
            prop: 1,
          },
          type: `${appName}/${environmentName}/${entityName}`,
        },
        {
          ancestors: [],
          embedding: [],
          model: {
            prop: 2,
          },
          type: `${appName}/${environmentName}/${entityName}`,
        },
        {
          ancestors: [],
          embedding: [],
          model: {
            prop: 3,
          },
          type: `${appName}/${environmentName}/${entityName}`,
        },
      ]);

      const environment = await getEnvironmentsFromDbByName(environmentName);
      expect(environment).not.toBeNull();
      expect(environment?.entities).toStrictEqual([entityName]);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}`,
        token: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("should return 201 CREATED and create sub entity", async () => {
      const mainEntityName = "myEntity";
      const subEntityName = "subEntity";
      const response = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}/${mainEntityName}`,
        token: jwtToken,
        body: [{ prop: 1 }],
      });
      expect(response.status).toBe(201);
      const {
        ids: [id],
      } = (await response.json()) as { ids: string[] };
      expect(id).toBeString();

      const subEntityResponse = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}/${mainEntityName}/${id}/${subEntityName}`,
        token: jwtToken,
        body: [{ subEntityProp: 1 }],
      });
      expect(subEntityResponse.status).toBe(201);
      const { ids } = (await subEntityResponse.json()) as { ids: string[] };
      expect(ids).toBeArrayOfSize(1);
      expect(ids.at(0)).toBeString();

      const entities = await getEntitiesByIdFromDatabase(ids);
      expect(R.keys(entities.at(0)!)).toStrictEqual([
        "id",
        "type",
        "ancestors",
        "model",
        "embedding",
      ]);

      const entitiesWithoutId = entities.map((entity) => {
        expect(entity.id).toBeString();
        return R.omit(["id"], entity);
      });

      deepEqual(entitiesWithoutId, [
        {
          ancestors: [id],
          embedding: [],
          model: {
            subEntityProp: 1,
          },
          type: `${appName}/${environmentName}/${mainEntityName}/${subEntityName}`,
        },
      ]);

      const environment = await getEnvironmentsFromDbByName(environmentName);
      expect(environment).not.toBeNull();
      expect(environment?.entities).toStrictEqual([
        mainEntityName,
        `${mainEntityName}/${subEntityName}`,
      ]);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${mainEntityName}`,
        token: jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });

  describe("PATCH /apps/:appName/:envName/:entityName", async () => {
    const patchAppName = "memes-app-2";
    const patchEnvironmentName = "environment-2";
    const patchEntityName = "myEntity";
    const patchSubEntityName = "mySubEntity";
    const entities: { prop: number }[] = [
      { prop: 1 },
      { prop: 2 },
      { prop: 3 },
    ];

    const subEntities: { subEntityProp: number }[] = [
      { subEntityProp: 1 },
      { subEntityProp: 2 },
      { subEntityProp: 3 },
    ];

    const createdEntityIds: string[] = [];
    const createdSubEntityIds: string[] = [];
    let entityIdWithSubEntity: string = "";

    beforeAll(async () => {
      const appResponse = await helper.executePostRequest({
        url: `/apps/${patchAppName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(appResponse.status).toBe(201);

      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}`,
        token: jwtToken,
        body: {
          description: "This is an environment",
        },
      });
      expect(environmentResponse.status).toBe(201);

      const entityResponse = await helper.executePostRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
        token: jwtToken,
        body: entities,
      });
      expect(entityResponse.status).toBe(201);
      const { ids } = (await entityResponse.json()) as { ids: string[] };
      createdEntityIds.push(...ids);

      entityIdWithSubEntity = createdEntityIds[2];
      const subEntityResponse = await helper.executePostRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}/${entityIdWithSubEntity}/${patchSubEntityName}`,
        token: jwtToken,
        body: subEntities,
      });
      expect(subEntityResponse.status).toBe(201);
      const { ids: subEntityIds } = (await subEntityResponse.json()) as {
        ids: string[];
      };
      createdSubEntityIds.push(...subEntityIds);
    });

    test("Should return 401 UNAUTHORIZED when no token is present", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/entityName`,
        body: [],
      });
      expect(response.status).toBe(401);
    });

    describe("Should return 400 BAD REQUEST", () => {
      test("when body is missing or it's not an array", async () => {
        const response = await helper.executePatchRequest({
          url: `/apps/${patchAppName}/${patchEnvironmentName}/entityName`,
          token: jwtToken,
        });
        expect(response.status).toBe(400);

        const response1 = await helper.executePatchRequest({
          url: `/apps/${patchAppName}/${patchEnvironmentName}/entityName`,
          token: jwtToken,
          body: {},
        });
        expect(response1.status).toBe(400);
      });

      test("when environment does not exist", async () => {
        const response = await helper.executePatchRequest({
          url: `/apps/${patchAppName}/not-existing-environment/entityName`,
          token: jwtToken,
          body: [{ prop: "value" }],
        });
        expect(response.status).toBe(400);
      });

      test("when no entities are found", async () => {
        const response = await helper.executePatchRequest({
          url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
          token: jwtToken,
          body: [{ id: "randomId", prop: "value" }],
        });
        expect(response.status).toBe(400);
      });
    });

    test("Should return 200 OK and update the entity", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
        token: jwtToken,
        body: [
          { id: createdEntityIds[0], secondProp: 3 },
          { id: createdEntityIds[1], prop: 66, secondProp: 66 },
        ],
      });
      expect(response.status).toBe(200);

      const { ids } = (await response.json()) as { ids: string[] };

      expect(ids).toBeArrayOfSize(2);
      expect(ids).toContain(createdEntityIds[0]);
      expect(ids).toContain(createdEntityIds[1]);

      const entitiesFromDb =
        await getEntitiesByIdFromDatabase(createdEntityIds);

      const entitiesWithoutId = entitiesFromDb.map((entity) => {
        const { id, ...props } = entity;
        expect(id).toBeString();
        return props;
      });

      deepEqual(entitiesWithoutId, [
        {
          ancestors: [],
          embedding: [],
          model: {
            // just attaching secondProp
            prop: 1,
            secondProp: 3,
          },
          type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
        },
        {
          ancestors: [],
          embedding: [],
          model: {
            // not updating at all
            prop: 3,
          },
          type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
        },
        {
          ancestors: [],
          embedding: [],
          model: {
            // replacing prop and attaching secondProp
            prop: 66,
            secondProp: 66,
          },
          type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
        },
      ]);
    });

    test("Should return 200 OK and ignore entities that don't have an attached id", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
        token: jwtToken,
        body: [
          { id: createdEntityIds[2], thirdProp: 3 },
          { thirdProp: 3 },
          { thirdProp: 6 },
        ],
      });
      expect(response.status).toBe(200);

      const { ids } = (await response.json()) as { ids: string[] };

      expect(ids).toBeArrayOfSize(1);
      expect(ids.at(0)).toEqual(createdEntityIds[2]);

      const [entityFromDb] = await getEntitiesByIdFromDatabase([
        createdEntityIds[2],
      ]);

      deepEqual(entityFromDb, {
        ancestors: [],
        embedding: [],
        id: createdEntityIds[2],
        model: {
          prop: 3,
          thirdProp: 3,
        },
        type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
      });
    });

    test("Should return 200 OK and update the sub entities", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}/${entityIdWithSubEntity}/${patchSubEntityName}`,
        token: jwtToken,
        body: [
          { id: createdSubEntityIds[0], secondProp: 3 },
          { id: createdSubEntityIds[1], subEntityProp: 66, secondProp: 66 },
        ],
      });
      expect(response.status).toBe(200);

      const { ids } = (await response.json()) as { ids: string[] };

      expect(ids).toBeArrayOfSize(2);
      expect(ids).toContain(createdSubEntityIds[0]);
      expect(ids).toContain(createdSubEntityIds[1]);

      const entitiesFromDb = await getEntitiesByIdFromDatabase(
        createdSubEntityIds,
        "model.subEntityProp",
      );

      const entitiesWithoutId = entitiesFromDb.map((entity) => {
        const { id, ...props } = entity;
        expect(id).toBeString();
        return props;
      });

      deepEqual(entitiesWithoutId, [
        {
          ancestors: [entityIdWithSubEntity],
          embedding: [],
          model: {
            // just attaching secondProp
            subEntityProp: 1,
            secondProp: 3,
          },
          type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}/${patchSubEntityName}`,
        },
        {
          ancestors: [entityIdWithSubEntity],
          embedding: [],
          model: {
            // not updating at all
            subEntityProp: 3,
          },
          type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}/${patchSubEntityName}`,
        },
        {
          ancestors: [entityIdWithSubEntity],
          embedding: [],
          model: {
            // replacing prop and attaching secondProp
            subEntityProp: 66,
            secondProp: 66,
          },
          type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}/${patchSubEntityName}`,
        },
      ]);
    });
  });

  describe("PUT /apps/:appName/:envName/:entityName", async () => {
    const putAppName = "memes-app-3";
    const putEnvironmentName = "environment-3";
    const putEntityName = "myEntity-1";
    const putSubEntityName = "mySubEntity-1";
    const entities: { prop: number }[] = [
      { prop: 1 },
      { prop: 2 },
      { prop: 3 },
    ];

    const subEntities: { subEntityProp: number }[] = [
      { subEntityProp: 1 },
      { subEntityProp: 2 },
      { subEntityProp: 3 },
    ];

    const createdEntityIds: string[] = [];
    const createdSubEntityIds: string[] = [];
    let entityIdWithSubEntity: string = "";

    beforeAll(async () => {
      const appResponse = await helper.executePostRequest({
        url: `/apps/${putAppName}`,
        token: jwtToken,
        body: {
          image: "path/to/image.jpg",
          description: "Memes app",
        },
      });
      expect(appResponse.status).toBe(201);

      const environmentResponse = await helper.executePostRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}`,
        token: jwtToken,
        body: {
          description: "This is an environment",
        },
      });
      expect(environmentResponse.status).toBe(201);

      const entityResponse = await helper.executePostRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}`,
        token: jwtToken,
        body: entities,
      });
      expect(entityResponse.status).toBe(201);
      const { ids } = (await entityResponse.json()) as { ids: string[] };
      createdEntityIds.push(...ids);

      entityIdWithSubEntity = createdEntityIds[2];
      const subEntityResponse = await helper.executePostRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}/${entityIdWithSubEntity}/${putSubEntityName}`,
        token: jwtToken,
        body: subEntities,
      });
      expect(subEntityResponse.status).toBe(201);
      const { ids: subEntityIds } = (await subEntityResponse.json()) as {
        ids: string[];
      };
      createdSubEntityIds.push(...subEntityIds);
    });

    test("Should return 401 UNAUTHORIZED when no token is present", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/entityName`,
        body: [],
      });
      expect(response.status).toBe(401);
    });

    describe("Should return 400 BAD REQUEST", () => {
      test("when body is missing or it's not an array", async () => {
        const response = await helper.executePutRequest({
          url: `/apps/${putAppName}/${putEnvironmentName}/entityName`,
          token: jwtToken,
        });
        expect(response.status).toBe(400);

        const response1 = await helper.executePutRequest({
          url: `/apps/${putAppName}/${putEnvironmentName}/entityName`,
          token: jwtToken,
          body: {},
        });
        expect(response1.status).toBe(400);
      });

      test("when environment does not exist", async () => {
        const response = await helper.executePutRequest({
          url: `/apps/${putAppName}/not-existing-environment/entityName`,
          token: jwtToken,
          body: [{ prop: "value" }],
        });
        expect(response.status).toBe(400);
      });

      test("when no entities are found", async () => {
        const response = await helper.executePutRequest({
          url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}`,
          token: jwtToken,
          body: [{ id: "randomId", prop: "value" }],
        });
        expect(response.status).toBe(400);
      });
    });

    test("Should return 200 OK and replace the entity", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}`,
        token: jwtToken,
        body: [
          { id: createdEntityIds[0], secondProp: 3 },
          { id: createdEntityIds[1], newProp: 66, secondProp: 66 },
        ],
      });
      expect(response.status).toBe(200);

      const { ids } = (await response.json()) as { ids: string[] };

      expect(ids).toBeArrayOfSize(2);
      expect(ids).toContain(createdEntityIds[0]);
      expect(ids).toContain(createdEntityIds[1]);

      const entitiesFromDb = await getEntitiesByIdFromDatabase(
        createdEntityIds,
        "model.secondProp",
      );

      const entitiesWithoutId = entitiesFromDb.map((entity) => {
        const { id, ...props } = entity;
        expect(id).toBeString();
        return props;
      });

      deepEqual(entitiesWithoutId, [
        {
          ancestors: [],
          embedding: [],
          model: {
            prop: 3,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
        },
        {
          ancestors: [],
          embedding: [],
          model: {
            secondProp: 3,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
        },
        {
          ancestors: [],
          embedding: [],
          model: {
            newProp: 66,
            secondProp: 66,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
        },
      ]);
    });

    test("Should return 200 OK and INSERT entities that don't have an attached id", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}`,
        token: jwtToken,
        body: [
          { id: createdEntityIds[2], thirdProp: 3 },
          { newEntityProp: 3 },
          { newEntityProp: 6 },
        ],
      });
      expect(response.status).toBe(200);

      const { ids } = (await response.json()) as { ids: string[] };

      expect(ids).toBeArrayOfSize(3);
      expect(ids).toContain(createdEntityIds[2]);

      const entityFromDb = await getEntitiesByIdFromDatabase(
        ids,
        "model.newEntityProp",
      );

      deepEqual(
        entityFromDb.find((x) => x.id === createdEntityIds[2]),
        {
          ancestors: [],
          embedding: [],
          id: createdEntityIds[2],
          model: {
            thirdProp: 3,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
        },
      );

      const entitiesWithoutId = entityFromDb
        .filter((x) => x.id !== createdEntityIds[2])
        .map((x) => {
          expect(x.id).toBeString();
          return R.omit(["id"], x);
        });

      deepEqual(entitiesWithoutId, [
        {
          ancestors: [],
          embedding: [],
          model: {
            newEntityProp: 3,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
        },
        {
          ancestors: [],
          embedding: [],
          model: {
            newEntityProp: 6,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
        },
      ]);
    });

    test("Should return 200 OK and replace the sub entity", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}/${entityIdWithSubEntity}/${putSubEntityName}`,
        token: jwtToken,
        body: [
          { id: createdSubEntityIds[0], secondProp: 3 },
          { id: createdSubEntityIds[1], subEntityProp: 66, secondProp: 66 },
        ],
      });
      expect(response.status).toBe(200);

      const { ids } = (await response.json()) as { ids: string[] };

      expect(ids).toBeArrayOfSize(2);
      expect(ids).toContain(createdSubEntityIds[0]);
      expect(ids).toContain(createdSubEntityIds[1]);

      const entitiesFromDb = await getEntitiesByIdFromDatabase(
        createdSubEntityIds,
        "model.subEntityProp",
      );

      const entitiesWithoutId = entitiesFromDb.map((entity) => {
        const { id, ...props } = entity;
        expect(id).toBeString();
        return props;
      });

      deepEqual(entitiesWithoutId, [
        {
          ancestors: [entityIdWithSubEntity],
          embedding: [],
          model: {
            secondProp: 3,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}/${putSubEntityName}`,
        },
        {
          ancestors: [entityIdWithSubEntity],
          embedding: [],
          model: {
            subEntityProp: 3,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}/${putSubEntityName}`,
        },
        {
          ancestors: [entityIdWithSubEntity],
          embedding: [],
          model: {
            subEntityProp: 66,
            secondProp: 66,
          },
          type: `${putAppName}/${putEnvironmentName}/${putEntityName}/${putSubEntityName}`,
        },
      ]);
    });
  });
});
