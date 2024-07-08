import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { deepEqual } from "assert";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("DELETE /apps/:appName/:envName/:entityName", () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  const deleteAppName = "memes-app-4";
  const deleteEnvironmentName = "environment-4";
  const deleteEntityName = "myEntity-4";
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
      appName: deleteAppName,
      environmentName: deleteEnvironmentName,
      jwtToken,
      entityName: deleteEntityName,
      entities,
    });

    createdEntityIds = entityIds;
    appToken = aToken;
    envToken = eToken;
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  test("should return 404 NOT FOUND when environment does not exist", async () => {
    const response = await helper.executeDeleteRequest({
      url: `/apps/${deleteAppName}/not-existing-environment/${deleteEntityName}`,
      jwtToken,
    });
    expect(response.status).toBe(404);
  });

  describe("should return 401 UNAUTHORIZED", () => {
    test("when no JWT or backend token is present", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}/${deleteEnvironmentName}/${deleteEntityName}`,
      });
      expect(response.status).toBe(401);
      const secondResponse = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}/${deleteEnvironmentName}/${deleteEntityName}/${createdEntityIds[0]}`,
      });
      expect(secondResponse.status).toBe(401);
    });

    test("when application token (backend token) does not have permissions on the application", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}-2/${deleteEnvironmentName}/${deleteEntityName}`,
        backendToken: appToken,
      });
      expect(response.status).toBe(401);

      const secondResponse = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}-2/${deleteEnvironmentName}/${deleteEntityName}/${createdEntityIds[0]}`,
        backendToken: appToken,
      });
      expect(secondResponse.status).toBe(401);
    });

    test("when environment token (backend token) does not have permissions on the environment", async () => {
      const response = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}/dev/${deleteEntityName}`,
        backendToken: envToken,
      });
      expect(response.status).toBe(401);

      const secondResponse = await helper.executeDeleteRequest({
        url: `/apps/${deleteAppName}/dev/${deleteEntityName}/${createdEntityIds[0]}`,
        backendToken: envToken,
      });
      expect(secondResponse.status).toBe(401);
    });
  });

  describe("Delete all entities by name endpoint", () => {
    test("Should return 200 OK and delete all entities by name + update the environment using JWT auth", async () => {
      const appName = "random-app";
      const environmentName = "random-environment";
      const entityName = "random-entity-name";
      const { entityIds } = await helper.createAppWithEnvironmentEntities({
        appName,
        environmentName,
        jwtToken,
        entityName,
        entities: [entities[0], entities[1]],
      });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: 2 });

      const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
        entityIds,
        "model.secondProp",
      );

      expect(entitiesFromDb).toBeArrayOfSize(0);

      const environment =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment?.entities).toBeArrayOfSize(0);
      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("Should return 200 OK and delete all entities by name + update the environment using application token (backend token) auth", async () => {
      const appName = "random-app";
      const environmentName = "random-environment";
      const entityName = "random-entity-name";
      const { entityIds, appToken } =
        await helper.createAppWithEnvironmentEntities({
          appName,
          environmentName,
          entityName,
          entities: [entities[0], entities[1]],
        });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}`,
        backendToken: appToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: 2 });

      const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
        entityIds,
        "model.secondProp",
      );

      expect(entitiesFromDb).toBeArrayOfSize(0);

      const environment =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment?.entities).toBeArrayOfSize(0);
      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("Should return 200 OK and delete all entities by name + update the environment using environment token (backend token) auth", async () => {
      const appName = "random-app";
      const environmentName = "random-environment";
      const entityName = "random-entity-name";
      const { entityIds, appToken, envToken } =
        await helper.createAppWithEnvironmentEntities({
          appName,
          environmentName,
          entityName,
          entities: [entities[0], entities[1]],
        });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}`,
        backendToken: envToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: 2 });

      const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
        entityIds,
        "model.secondProp",
      );

      expect(entitiesFromDb).toBeArrayOfSize(0);

      const environment =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment?.entities).toBeArrayOfSize(0);
      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });

  describe("entity by id endpoint", () => {
    test("Should return 200 OK and delete the entity by id using JWT auth", async () => {
      const appName = "random-app";
      const environmentName = "random-environment";
      const entityName = "random-entity-name";
      const { entityIds } = await helper.createAppWithEnvironmentEntities({
        appName,
        environmentName,
        jwtToken,
        entityName,
        entities: [entities[0], entities[1]],
      });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityIds[0]}`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb =
        await helper.getEntitiesByIdFromDatabase(entityIds);

      expect(entitiesFromDb).toBeArrayOfSize(1);
      deepEqual(R.omit(["id"], entitiesFromDb[0]), {
        model: {
          prop: 2,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      });

      const environment =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment?.entities).toBeArrayOfSize(1);
      expect(environment?.entities).toStrictEqual([entityName]);

      // when we delete the second one, the environment should be updated as well
      const finalDeleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityIds[1]}`,
        jwtToken,
      });
      expect(finalDeleteResponse.status).toBe(200);
      expect(await finalDeleteResponse.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb1 =
        await helper.getEntitiesByIdFromDatabase(entityIds);

      expect(entitiesFromDb1).toBeArrayOfSize(0);

      const environment1 =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment1?.entities).toBeArrayOfSize(0);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        jwtToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("Should return 200 OK and delete the entity by id using application token (backend token) auth", async () => {
      const appName = "random-app";
      const environmentName = "random-environment";
      const entityName = "random-entity-name";
      const { entityIds, appToken } =
        await helper.createAppWithEnvironmentEntities({
          appName,
          environmentName,
          entityName,
          entities: [entities[0], entities[1]],
        });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityIds[0]}`,
        backendToken: appToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb =
        await helper.getEntitiesByIdFromDatabase(entityIds);

      expect(entitiesFromDb).toBeArrayOfSize(1);
      deepEqual(R.omit(["id"], entitiesFromDb[0]), {
        model: {
          prop: 2,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      });

      const environment =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment?.entities).toBeArrayOfSize(1);
      expect(environment?.entities).toStrictEqual([entityName]);

      // when we delete the second one, the environment should be updated as well
      const finalDeleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityIds[1]}`,
        backendToken: appToken,
      });
      expect(finalDeleteResponse.status).toBe(200);
      expect(await finalDeleteResponse.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb1 =
        await helper.getEntitiesByIdFromDatabase(entityIds);

      expect(entitiesFromDb1).toBeArrayOfSize(0);

      const environment1 =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment1?.entities).toBeArrayOfSize(0);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("Should return 200 OK and delete the entity by id using environment token (backend token) auth", async () => {
      const appName = "random-app";
      const environmentName = "random-environment";
      const entityName = "random-entity-name";
      const { entityIds, appToken, envToken } =
        await helper.createAppWithEnvironmentEntities({
          appName,
          environmentName,
          entityName,
          entities: [entities[0], entities[1]],
        });

      const response = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityIds[0]}`,
        backendToken: envToken,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb =
        await helper.getEntitiesByIdFromDatabase(entityIds);

      expect(entitiesFromDb).toBeArrayOfSize(1);
      deepEqual(R.omit(["id"], entitiesFromDb[0]), {
        model: {
          prop: 2,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      });

      const environment =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment?.entities).toBeArrayOfSize(1);
      expect(environment?.entities).toStrictEqual([entityName]);

      // when we delete the second one, the environment should be updated as well
      const finalDeleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityIds[1]}`,
        backendToken: envToken,
      });
      expect(finalDeleteResponse.status).toBe(200);
      expect(await finalDeleteResponse.json()).toStrictEqual({ deleted: true });

      const entitiesFromDb1 =
        await helper.getEntitiesByIdFromDatabase(entityIds);

      expect(entitiesFromDb1).toBeArrayOfSize(0);

      const environment1 =
        await helper.getEnvironmentFromDbByName(environmentName);
      expect(environment1?.entities).toBeArrayOfSize(0);

      const deleteResponse = await helper.executeDeleteRequest({
        url: `/apps/${appName}`,
        backendToken: appToken,
      });
      expect(deleteResponse.status).toBe(200);
    });
  });
});
