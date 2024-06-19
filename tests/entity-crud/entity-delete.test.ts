import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TestApplicationHelper } from "../helpers/test-application-helper.ts";
import { deepEqual } from "assert";
import * as R from "ramda";
import { defaultTestUser } from "../helpers/testUsers.ts";

describe("DELETE /apps/:appName/:envName/:entityName", () => {
  const helper = new TestApplicationHelper();
  let jwtToken = "";

  const deleteAppName = "memes-app-4";
  const deleteEnvironmentName = "environment-4";
  const deleteEntityName = "myEntity-4";
  const deleteSubEntityName = "mySubEntity-4";
  const entities: { prop: number }[] = [{ prop: 1 }, { prop: 2 }, { prop: 3 }];

  const subEntities: { subEntityProp: number }[] = [
    { subEntityProp: 1 },
    { subEntityProp: 2 },
    { subEntityProp: 3 },
  ];

  const createdEntityIds: string[] = [];

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
    const { createdEntityIds: ids } =
      await helper.createAppWithEnvironmentEntitiesAndSubEntities({
        appName: deleteAppName,
        environmentName: deleteEnvironmentName,
        token: jwtToken,
        entityName: deleteEntityName,
        subEntityName: deleteSubEntityName,
        entities,
        subEntities,
      });

    createdEntityIds.push(...ids);
  });

  afterAll(async () => {
    await helper.stopApplication();
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

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
      createdEntityIds,
      "model.secondProp",
    );

    expect(entitiesFromDb).toBeArrayOfSize(0);

    const environment = await helper.getEnvironmentFromDbByName(
      deleteEnvironmentName,
    );
    expect(environment?.entities).toBeArrayOfSize(0);
  });

  test("Should return 200 OK and delete the entity by id", async () => {
    const appName = "random-app";
    const environmentName = "random-environment";
    const entityName = "random-entity-name";
    const { createdEntityIds: ids } =
      await helper.createAppWithEnvironmentEntitiesAndSubEntities({
        appName,
        environmentName,
        token: jwtToken,
        entityName,
        entities: [entities[0], entities[1]],
      });

    const response = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}/${ids[0]}`,
      token: jwtToken,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ deleted: true });

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(ids);

    expect(entitiesFromDb).toBeArrayOfSize(1);
    deepEqual(R.omit(["id"], entitiesFromDb[0]), {
      ancestors: [],
      embedding: [],
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
      url: `/apps/${appName}/${environmentName}/${entityName}/${ids[1]}`,
      token: jwtToken,
    });
    expect(finalDeleteResponse.status).toBe(200);
    expect(await finalDeleteResponse.json()).toStrictEqual({ deleted: true });

    const entitiesFromDb1 = await helper.getEntitiesByIdFromDatabase(ids);

    expect(entitiesFromDb1).toBeArrayOfSize(0);

    const environment1 =
      await helper.getEnvironmentFromDbByName(environmentName);
    expect(environment1?.entities).toBeArrayOfSize(0);
  });

  test("Should return 200 OK and delete the sub entity", async () => {
    const appName = "random-app-1";
    const environmentName = "random-environment-1";
    const entityName = "random-entity-name-1";
    const subEntityName = "random-sub-entity-name-1";

    const { entityIdWithSubEntity: entityId, createdSubEntityIds: subIds } =
      await helper.createAppWithEnvironmentEntitiesAndSubEntities({
        appName,
        environmentName,
        token: jwtToken,
        entityName,
        entities,
        subEntityName,
        subEntities,
      });

    const response = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}/${entityId}/${subEntityName}`,
      token: jwtToken,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ deleted: 3 });

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(subIds!);

    expect(entitiesFromDb).toBeArrayOfSize(0);

    const environment =
      await helper.getEnvironmentFromDbByName(environmentName);
    expect(environment!.entities).toBeArrayOfSize(1);
    expect(environment!.entities).toStrictEqual([entityName]);
  });

  test("Should return 200 OK and delete the sub entity by id", async () => {
    const appName = "random-app-2";
    const environmentName = "random-environment-2";
    const entityName = "random-entity-name-2";
    const subEntityName = "random-sub-entity-name-2";

    const { entityIdWithSubEntity: entityId, createdSubEntityIds: subIds } =
      await helper.createAppWithEnvironmentEntitiesAndSubEntities({
        appName,
        environmentName,
        token: jwtToken,
        entityName,
        entities,
        subEntityName,
        subEntities: [subEntities[0], subEntities[1]],
      });

    const response = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}/${entityId}/${subEntityName}/${subIds![0]}`,
      token: jwtToken,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ deleted: true });

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(subIds!);

    expect(entitiesFromDb).toBeArrayOfSize(1);

    deepEqual(R.omit(["id"], entitiesFromDb[0]), {
      ancestors: [entityId],
      embedding: [],
      model: {
        subEntityProp: 2,
      },
      type: `${appName}/${environmentName}/${entityName}/${subEntityName}`,
    });

    const environment =
      await helper.getEnvironmentFromDbByName(environmentName);
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

    const entitiesFromDb1 = await helper.getEntitiesByIdFromDatabase(subIds!);

    expect(entitiesFromDb1).toBeArrayOfSize(0);

    const environment1 =
      await helper.getEnvironmentFromDbByName(environmentName);
    expect(environment1!.entities).toBeArrayOfSize(1);
    expect(environment1!.entities).toStrictEqual([entityName]);
  });
});
