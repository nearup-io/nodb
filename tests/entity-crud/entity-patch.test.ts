import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { deepEqual } from "assert";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("PATCH /apps/:appName/:envName/:entityName", () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  const patchAppName = "memes-app-2";
  const patchEnvironmentName = "environment-2";
  const patchEntityName = "myEntity";
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
      appName: patchAppName,
      environmentName: patchEnvironmentName,
      jwtToken,
      entities,
      entityName: patchEntityName,
    });

    createdEntityIds = entityIds;
    appToken = aToken;
    envToken = eToken;
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  test("Should return 401 UNAUTHORIZED when no token is present", async () => {
    const response = await helper.executePatchRequest({
      url: `/apps/${patchAppName}/${patchEnvironmentName}/entityName`,
      body: [],
    });
    expect(response.status).toBe(401);
  });

  describe("Should return 403 FORBIDDEN", () => {
    test("when application token (backend token) does not have permissions for updating the requested app", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}-2/${patchEnvironmentName}/entityName`,
        backendToken: appToken,
        body: [],
      });
      expect(response.status).toBe(403);
    });

    test("when environment token (backend token) does not have permissions for updating the requested app", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/dev/entityName`,
        backendToken: envToken,
        body: [],
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Should return 400 BAD REQUEST", () => {
    test("when body is missing or it's not an array", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/entityName`,
        jwtToken,
      });
      expect(response.status).toBe(400);

      const response1 = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/entityName`,
        jwtToken,
        body: {},
      });
      expect(response1.status).toBe(400);
    });

    test("when environment does not exist", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/not-existing-environment/entityName`,
        jwtToken,
        body: [{ prop: "value" }],
      });
      expect(response.status).toBe(400);
    });

    test("when no entities are found", async () => {
      const response = await helper.executePatchRequest({
        url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
        jwtToken,
        body: [{ id: "randomId", prop: "value" }],
      });
      expect(response.status).toBe(400);
    });
  });

  test("Should return 200 OK and update the entity using JWT auth", async () => {
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

    const response = await helper.executePatchRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      jwtToken,
      body: [
        { id: entityIds[0], secondProp: 3 },
        { id: entityIds[1], prop: 66, secondProp: 66 },
      ],
    });
    expect(response.status).toBe(200);

    const { ids } = (await response.json()) as { ids: string[] };

    expect(ids).toBeArrayOfSize(2);
    expect(ids).toContain(entityIds[0]);
    expect(ids).toContain(entityIds[1]);

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(entityIds);

    const entitiesWithoutId = entitiesFromDb.map((entity) => {
      const { id, ...props } = entity;
      expect(id).toBeString();
      return props;
    });

    deepEqual(entitiesWithoutId, [
      {
        model: {
          // just attaching secondProp
          prop: 1,
          secondProp: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          // not updating at all
          prop: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          // replacing prop and attaching secondProp
          prop: 66,
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

  test("Should return 200 OK and update the entity using application token (backend token) auth", async () => {
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

    const response = await helper.executePatchRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      backendToken: appToken,
      body: [
        { id: entityIds[0], secondProp: 3 },
        { id: entityIds[1], prop: 66, secondProp: 66 },
      ],
    });
    expect(response.status).toBe(200);

    const { ids } = (await response.json()) as { ids: string[] };

    expect(ids).toBeArrayOfSize(2);
    expect(ids).toContain(entityIds[0]);
    expect(ids).toContain(entityIds[1]);

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(entityIds);

    const entitiesWithoutId = entitiesFromDb.map((entity) => {
      const { id, ...props } = entity;
      expect(id).toBeString();
      return props;
    });

    deepEqual(entitiesWithoutId, [
      {
        model: {
          // just attaching secondProp
          prop: 1,
          secondProp: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          // not updating at all
          prop: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          // replacing prop and attaching secondProp
          prop: 66,
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

  test("Should return 200 OK and update the entity using environment token (backend token) auth", async () => {
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

    const response = await helper.executePatchRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      backendToken: envToken,
      body: [
        { id: entityIds[0], secondProp: 3 },
        { id: entityIds[1], prop: 66, secondProp: 66 },
      ],
    });
    expect(response.status).toBe(200);

    const { ids } = (await response.json()) as { ids: string[] };

    expect(ids).toBeArrayOfSize(2);
    expect(ids).toContain(entityIds[0]);
    expect(ids).toContain(entityIds[1]);

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(entityIds);

    const entitiesWithoutId = entitiesFromDb.map((entity) => {
      const { id, ...props } = entity;
      expect(id).toBeString();
      return props;
    });

    deepEqual(entitiesWithoutId, [
      {
        model: {
          // just attaching secondProp
          prop: 1,
          secondProp: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          // not updating at all
          prop: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          // replacing prop and attaching secondProp
          prop: 66,
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

  test("Should return 200 OK and ignore entities that don't have an attached id", async () => {
    const response = await helper.executePatchRequest({
      url: `/apps/${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
      jwtToken,
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

    const [entityFromDb] = await helper.getEntitiesByIdFromDatabase([
      createdEntityIds[2],
    ]);

    deepEqual(entityFromDb, {
      id: createdEntityIds[2],
      model: {
        prop: 3,
        thirdProp: 3,
      },
      type: `${patchAppName}/${patchEnvironmentName}/${patchEntityName}`,
    });
  });
});
