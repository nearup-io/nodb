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

const getEnvironmentFromDbByName = async (
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

const createAppWithEnvironmentEntitiesAndSubEntities = async ({
  appName,
  token,
  environmentName,
  entityName,
  appStarter,
  entities,
  subEntityName,
  subEntities,
}: {
  appName: string;
  environmentName: string;
  token: string;
  entityName: string;
  appStarter: TestApplicationStarter;
  entities: any[];
  subEntityName?: string;
  subEntities?: any[];
}): Promise<{
  createdEntityIds: string[];
  createdSubEntityIds?: string[];
  entityIdWithSubEntity?: string;
}> => {
  const appResponse = await appStarter.executePostRequest({
    url: `/apps/${appName}`,
    token,
    body: {
      image: "path/to/image.jpg",
      description: "Memes app",
    },
  });
  expect(appResponse.status).toBe(201);

  const environmentResponse = await appStarter.executePostRequest({
    url: `/apps/${appName}/${environmentName}`,
    token,
    body: {
      description: "This is an environment",
    },
  });
  expect(environmentResponse.status).toBe(201);

  const entityResponse = await appStarter.executePostRequest({
    url: `/apps/${appName}/${environmentName}/${entityName}`,
    token,
    body: entities,
  });
  expect(entityResponse.status).toBe(201);
  const { ids } = (await entityResponse.json()) as { ids: string[] };

  if (!!subEntityName && !!subEntities) {
    const entityIdWithSubEntity = ids[2];
    const subEntityResponse = await appStarter.executePostRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}`,
      token,
      body: subEntities,
    });
    expect(subEntityResponse.status).toBe(201);
    const { ids: subEntityIds } = (await subEntityResponse.json()) as {
      ids: string[];
    };
    return {
      createdEntityIds: ids,
      entityIdWithSubEntity: entityIdWithSubEntity,
      createdSubEntityIds: subEntityIds,
    };
  }

  return {
    createdEntityIds: ids,
  };
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

      const environment = await getEnvironmentFromDbByName(environmentName);
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

      const environment = await getEnvironmentFromDbByName(environmentName);
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
      const {
        createdEntityIds: ids,
        createdSubEntityIds: subIds,
        entityIdWithSubEntity: entityId,
      } = await createAppWithEnvironmentEntitiesAndSubEntities({
        appStarter: helper,
        appName: patchAppName,
        environmentName: patchEnvironmentName,
        token: jwtToken,
        entities,
        subEntityName: patchSubEntityName,
        subEntities,
        entityName: patchEntityName,
      });

      createdEntityIds.push(...ids);
      createdSubEntityIds.push(...subIds!);
      entityIdWithSubEntity = entityId!;
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
      beforeAll(async () => {
        const {
          createdEntityIds: ids,
          createdSubEntityIds: subIds,
          entityIdWithSubEntity: entityId,
        } = await createAppWithEnvironmentEntitiesAndSubEntities({
          appStarter: helper,
          appName: putAppName,
          environmentName: putEnvironmentName,
          token: jwtToken,
          entities,
          subEntityName: putSubEntityName,
          subEntities,
          entityName: putEntityName,
        });

        createdEntityIds.push(...ids);
        createdSubEntityIds.push(...subIds!);
        entityIdWithSubEntity = entityId!;
      });
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

  describe("DELETE /apps/:appName/:envName/:entityName", async () => {
    const deleteAppName = "memes-app-4";
    const deleteEnvironmentName = "environment-4";
    const deleteEntityName = "myEntity-4";
    const deleteSubEntityName = "mySubEntity-4";
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

    beforeAll(async () => {
      const { createdEntityIds: ids, createdSubEntityIds: subIds } =
        await createAppWithEnvironmentEntitiesAndSubEntities({
          appName: deleteAppName,
          environmentName: deleteEnvironmentName,
          token: jwtToken,
          entityName: deleteEntityName,
          subEntityName: deleteSubEntityName,
          entities,
          subEntities,
          appStarter: helper,
        });

      createdEntityIds.push(...ids);
    });

    test("should return 404 NOT FOUND when environment does not exist", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}/not-existing-environment/${deleteEntityName}`,
        token: jwtToken,
      });
      expect(response.status).toBe(404);
    });

    test("Should return 401 UNAUTHORIZED when no token is present", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}/${deleteEnvironmentName}/${deleteEntityName}`,
      });
      expect(response.status).toBe(401);
    });

    test("Should return 200 OK and delete the entity + update the environment", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}/${deleteEnvironmentName}/${deleteEntityName}`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: 6 });

      const entitiesFromDb = await getEntitiesByIdFromDatabase(
        createdEntityIds,
        "model.secondProp",
      );

      expect(entitiesFromDb).toBeArrayOfSize(0);

      const environment = await getEnvironmentFromDbByName(
        deleteEnvironmentName,
      );
      expect(environment?.entities).toBeArrayOfSize(0);
    });

    test("Should return 200 OK and delete the entity by id", async () => {
      const appName = "random-app";
      const environmentName = "random-environment";
      const entityName = "random-entity-name";
      const { createdEntityIds: ids } =
        await createAppWithEnvironmentEntitiesAndSubEntities({
          appName,
          environmentName,
          token: jwtToken,
          entityName,
          entities: [entities[0], entities[1]],
          appStarter: helper,
        });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${ids[0]}`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb = await getEntitiesByIdFromDatabase(ids);

      expect(entitiesFromDb).toBeArrayOfSize(1);
      deepEqual(R.omit(["id"], entitiesFromDb[0]), {
        ancestors: [],
        embedding: [],
        model: {
          prop: 2,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      });

      const environment = await getEnvironmentFromDbByName(environmentName);
      expect(environment?.entities).toBeArrayOfSize(1);
      expect(environment?.entities).toStrictEqual([entityName]);

      // when we delete the second one, the environment should be updated as well
      const finalDeleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${ids[1]}`,
        token: jwtToken,
      });
      expect(finalDeleteResponse.status).toBe(200);
      expect(await finalDeleteResponse.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb1 = await getEntitiesByIdFromDatabase(ids);

      expect(entitiesFromDb1).toBeArrayOfSize(0);

      const environment1 = await getEnvironmentFromDbByName(environmentName);
      expect(environment1?.entities).toBeArrayOfSize(0);
    });

    test("Should return 200 OK and delete the sub entity", async () => {
      const appName = "random-app-1";
      const environmentName = "random-environment-1";
      const entityName = "random-entity-name-1";
      const subEntityName = "random-sub-entity-name-1";

      const {
        createdEntityIds: ids,
        entityIdWithSubEntity: entityId,
        createdSubEntityIds: subIds,
      } = await createAppWithEnvironmentEntitiesAndSubEntities({
        appName,
        environmentName,
        token: jwtToken,
        entityName,
        entities,
        appStarter: helper,
        subEntityName,
        subEntities,
      });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityId}/${subEntityName}`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: 3 });

      const entitiesFromDb = await getEntitiesByIdFromDatabase(subIds!);

      expect(entitiesFromDb).toBeArrayOfSize(0);

      const environment = await getEnvironmentFromDbByName(environmentName);
      expect(environment!.entities).toBeArrayOfSize(1);
      expect(environment!.entities).toStrictEqual([entityName]);
    });

    test("Should return 200 OK and delete the sub entity by id", async () => {
      const appName = "random-app-2";
      const environmentName = "random-environment-2";
      const entityName = "random-entity-name-2";
      const subEntityName = "random-sub-entity-name-2";

      const {
        createdEntityIds: ids,
        entityIdWithSubEntity: entityId,
        createdSubEntityIds: subIds,
      } = await createAppWithEnvironmentEntitiesAndSubEntities({
        appName,
        environmentName,
        token: jwtToken,
        entityName,
        entities,
        appStarter: helper,
        subEntityName,
        subEntities: [subEntities[0], subEntities[1]],
      });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityId}/${subEntityName}/${subIds![0]}`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb = await getEntitiesByIdFromDatabase(subIds!);

      expect(entitiesFromDb).toBeArrayOfSize(1);

      deepEqual(R.omit(["id"], entitiesFromDb[0]), {
        ancestors: [entityId],
        embedding: [],
        model: {
          subEntityProp: 2,
        },
        type: `${appName}/${environmentName}/${entityName}/${subEntityName}`,
      });

      const environment = await getEnvironmentFromDbByName(environmentName);
      expect(environment!.entities).toBeArrayOfSize(2);
      expect(environment!.entities).toStrictEqual([
        entityName,
        `${entityName}/${subEntityName}`,
      ]);

      // when we delete the second one, the environment should be updated as well
      const finalDeleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityId}/${subEntityName}/${subIds![1]}`,
        token: jwtToken,
      });
      expect(finalDeleteResponse.status).toBe(200);
      expect(await finalDeleteResponse.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb1 = await getEntitiesByIdFromDatabase(subIds!);

      expect(entitiesFromDb1).toBeArrayOfSize(0);

      const environment1 = await getEnvironmentFromDbByName(environmentName);
      expect(environment1!.entities).toBeArrayOfSize(1);
      expect(environment1!.entities).toStrictEqual([entityName]);
    });
  });

  describe.only("GET /apps/:appName/:envName/:entityName", async () => {
    const appName = "memes-app-5";
    const environmentName = "environment-5";
    const entityName = "myEntity-5";
    const subEntityName = "mySubEntity-5";
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
    let entityIdWithSubEntity = "";

    beforeAll(async () => {
      const {
        createdEntityIds: ids,
        createdSubEntityIds: subIds,
        entityIdWithSubEntity: entityId,
      } = await createAppWithEnvironmentEntitiesAndSubEntities({
        appName: appName,
        environmentName,
        token: jwtToken,
        entityName,
        subEntityName,
        entities,
        subEntities,
        appStarter: helper,
      });

      createdEntityIds.push(...ids);
      createdSubEntityIds.push(...subIds!);
      entityIdWithSubEntity = entityId!;
    });

    test("should return 404 NOT FOUND when environment does not exist for get entity by id", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/not-existing-environment/${entityName}/${createdEntityIds[0]}`,
        token: jwtToken,
      });
      expect(response.status).toBe(404);
    });

    test("should return 404 NOT FOUND when entity does not exist for get entity by id", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/not-existing-environment/${entityName}/not-existing-id`,
        token: jwtToken,
      });
      expect(response.status).toBe(404);
    });

    test("Should return 401 UNAUTHORIZED when no token is present", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}`,
      });
      expect(response.status).toBe(401);
    });

    describe("Get by id endpoint", () => {
      const requestedEntity = entities[0];
      let requestedEntityId = "";

      beforeAll(() => {
        requestedEntityId = createdEntityIds[0]!;
      });

      test("Should return 200 OK and entity with expected data", async () => {
        const response = await helper.executeGetRequest({
          url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
          token: jwtToken,
        });
        expect(response.status).toBe(200);
        deepEqual(await response.json(), {
          __meta: {
            self: `/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
            subtypes: {
              [`${subEntityName}`]: `/${appName}/${environmentName}/${entityName}/${requestedEntityId}/${subEntityName}`,
            },
          },
          id: requestedEntityId,
          ...requestedEntity,
        });
      });

      test("Should return 200 OK and subEntity with expected data", async () => {
        const requestedSubEntityId = createdSubEntityIds[0];
        const requestedSubEntity = subEntities[0];
        const subSubEntityName = "sub-sub-entity";
        const subSubEntities: { subSubEntityProp: number }[] = [
          { subSubEntityProp: 1 },
          { subSubEntityProp: 2 },
          { subSubEntityProp: 3 },
        ];

        const subSubSubEntityName = "sub-sub-sub-entity";
        const subSubSubEntities: { subSubSubEntityProp: number }[] = [
          { subSubSubEntityProp: 1 },
          { subSubSubEntityProp: 2 },
          { subSubSubEntityProp: 3 },
        ];

        const subSubEntityResponse = await helper.executePostRequest({
          url: `/apps/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}/${requestedSubEntityId}/${subSubEntityName}`,
          token: jwtToken,
          body: subSubEntities,
        });
        expect(subSubEntityResponse.status).toBe(201);

        const {
          ids: [subSubEntityId],
        } = (await subSubEntityResponse.json()) as { ids: string[] };

        const subSubSubEntityResponse = await helper.executePostRequest({
          url: `/apps/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}/${requestedSubEntityId}/${subSubEntityName}/${subSubEntityId}/${subSubSubEntityName}`,
          token: jwtToken,
          body: subSubSubEntities,
        });
        expect(subSubSubEntityResponse.status).toBe(201);

        const response = await helper.executeGetRequest({
          url: `/apps/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}/${requestedSubEntityId}`,
          token: jwtToken,
        });
        expect(response.status).toBe(200);

        const body = await response.json();
        deepEqual(body, {
          __meta: {
            self: `/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}/${requestedSubEntityId}`,
            subtypes: {
              // it should only return on subLevel of information
              [`${subSubEntityName}`]: `/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}/${requestedSubEntityId}/${subSubEntityName}`,
            },
          },
          id: requestedSubEntityId,
          ...requestedSubEntity,
        });
      });

      test("Should return 200 OK and should apply the __only filter from query params", async () => {});

      test("Should return 200 OK and not return the meta filters when __hasMeta=false is added to the query params", async () => {});
    });
  });
});
