import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { deepEqual } from "assert";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("PUT /apps/:appName/:envName/:entityName", () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  const putAppName = "memes-app-3";
  const putEnvironmentName = "environment-3";
  const putEntityName = "myEntity-1";
  const entities: { prop: number }[] = [{ prop: 1 }, { prop: 2 }, { prop: 3 }];

  let createdEntityIds: string[] = [];
  let appToken = "";
  let envToken = "";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
    const {
      entityIds,
      appToken: aToken,
      envToken: eToken,
    } = await helper.createAppWithEnvironmentEntities({
      appName: putAppName,
      environmentName: putEnvironmentName,
      jwtToken,
      entities,
      entityName: putEntityName,
    });

    createdEntityIds = entityIds;
    appToken = aToken;
    envToken = eToken;
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("Should return 400 BAD REQUEST", () => {
    test("when body is missing or it's not an array", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/entityName`,
        jwtToken,
      });
      expect(response.status).toBe(400);

      const response1 = await helper.executePutRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/entityName`,
        jwtToken,
        body: {},
      });
      expect(response1.status).toBe(400);
    });

    test("when environment does not exist", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/not-existing-environment/entityName`,
        jwtToken,
        body: [{ prop: "value" }],
      });
      expect(response.status).toBe(400);
    });

    test("when no entities are found", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}`,
        jwtToken,
        body: [{ id: "randomId", prop: "value" }],
      });
      expect(response.status).toBe(400);
    });
  });

  test("Should return 401 UNAUTHORIZED when no token is present", async () => {
    const response = await helper.executePutRequest({
      url: `/apps/${putAppName}/${putEnvironmentName}/entityName`,
      body: [],
    });
    expect(response.status).toBe(401);
  });

  describe("Should return 403 FORBIDDEN", () => {
    test("when application token (backend token) does not have permission for the application", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}-2/${putEnvironmentName}/entityName`,
        backendToken: appToken,
        body: [],
      });
      expect(response.status).toBe(403);
    });

    test("when environment token (backend token) does not have permission for the environment", async () => {
      const response = await helper.executePutRequest({
        url: `/apps/${putAppName}/dev/entityName`,
        backendToken: envToken,
        body: [],
      });
      expect(response.status).toBe(403);
    });
  });

  test("Should return 200 OK and replace the entity with JWT auth", async () => {
    const appName = "random-app";
    const environmentName = "random-environment";
    const entityName = "random-entity";
    const { entityIds } = await helper.createAppWithEnvironmentEntities({
      appName,
      environmentName,
      jwtToken,
      entities,
      entityName,
    });

    const response = await helper.executePutRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      jwtToken,
      body: [
        { id: entityIds[0], secondProp: 3 },
        { id: entityIds[1], newProp: 66, secondProp: 66 },
      ],
    });
    expect(response.status).toBe(200);

    const { ids } = (await response.json()) as { ids: string[] };

    expect(ids).toBeArrayOfSize(2);
    expect(ids).toContain(entityIds[0]);
    expect(ids).toContain(entityIds[1]);

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
      entityIds,
      "model.secondProp",
    );

    const entitiesWithoutId = entitiesFromDb.map((entity) => {
      const { id, ...props } = entity;
      expect(id).toBeString();
      return props;
    });

    deepEqual(entitiesWithoutId, [
      {
        model: {
          prop: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          secondProp: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          newProp: 66,
          secondProp: 66,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
    ]);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("Should return 200 OK and replace the entity with application token (backend token) auth", async () => {
    const appName = "random-app";
    const environmentName = "random-environment";
    const entityName = "random-entity";
    const { entityIds, appToken } =
      await helper.createAppWithEnvironmentEntities({
        appName,
        environmentName,
        jwtToken,
        entities,
        entityName,
      });

    const response = await helper.executePutRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      backendToken: appToken,
      body: [
        { id: entityIds[0], secondProp: 3 },
        { id: entityIds[1], newProp: 66, secondProp: 66 },
      ],
    });
    expect(response.status).toBe(200);

    const { ids } = (await response.json()) as { ids: string[] };

    expect(ids).toBeArrayOfSize(2);
    expect(ids).toContain(entityIds[0]);
    expect(ids).toContain(entityIds[1]);

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
      entityIds,
      "model.secondProp",
    );

    const entitiesWithoutId = entitiesFromDb.map((entity) => {
      const { id, ...props } = entity;
      expect(id).toBeString();
      return props;
    });

    deepEqual(entitiesWithoutId, [
      {
        model: {
          prop: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          secondProp: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          newProp: 66,
          secondProp: 66,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
    ]);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("Should return 200 OK and replace the entity with environment token (backend token) auth", async () => {
    const appName = "random-app";
    const environmentName = "random-environment";
    const entityName = "random-entity";
    const { entityIds, appToken, envToken } =
      await helper.createAppWithEnvironmentEntities({
        appName,
        environmentName,
        jwtToken,
        entities,
        entityName,
      });

    const response = await helper.executePutRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      backendToken: envToken,
      body: [
        { id: entityIds[0], secondProp: 3 },
        { id: entityIds[1], newProp: 66, secondProp: 66 },
      ],
    });
    expect(response.status).toBe(200);

    const { ids } = (await response.json()) as { ids: string[] };

    expect(ids).toBeArrayOfSize(2);
    expect(ids).toContain(entityIds[0]);
    expect(ids).toContain(entityIds[1]);

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
      entityIds,
      "model.secondProp",
    );

    const entitiesWithoutId = entitiesFromDb.map((entity) => {
      const { id, ...props } = entity;
      expect(id).toBeString();
      return props;
    });

    deepEqual(entitiesWithoutId, [
      {
        model: {
          prop: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          secondProp: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          newProp: 66,
          secondProp: 66,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
    ]);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      backendToken: appToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("Should return 200 OK and INSERT entities that don't have an attached id", async () => {
    const response = await helper.executePutRequest({
      url: `/apps/${putAppName}/${putEnvironmentName}/${putEntityName}`,
      jwtToken,
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

    const entityFromDb = await helper.getEntitiesByIdFromDatabase(
      ids,
      "model.newEntityProp",
    );

    deepEqual(
      entityFromDb.find((x) => x.id === createdEntityIds[2]),
      {
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
        model: {
          newEntityProp: 3,
        },
        type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
      },
      {
        model: {
          newEntityProp: 6,
        },
        type: `${putAppName}/${putEnvironmentName}/${putEntityName}`,
      },
    ]);
  });
});
