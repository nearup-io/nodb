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

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
    createdEntityIds = await helper.createAppWithEnvironmentEntities({
      appName: deleteAppName,
      environmentName: deleteEnvironmentName,
      jwtToken,
      entityName: deleteEntityName,
      entities,
    });
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

  test("Should return 401 UNAUTHORIZED when no token is present", async () => {
    const response = await helper.executeDeleteRequest({
      url: `/apps/${deleteAppName}/${deleteEnvironmentName}/${deleteEntityName}`,
    });
    expect(response.status).toBe(401);
  });

  test("Should return 200 OK and delete the entity + update the environment", async () => {
    const response = await helper.executeDeleteRequest({
      url: `/apps/${deleteAppName}/${deleteEnvironmentName}/${deleteEntityName}`,
      jwtToken: jwtToken,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ deleted: 3 });

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
    const ids = await helper.createAppWithEnvironmentEntities({
      appName,
      environmentName,
      jwtToken,
      entityName,
      entities: [entities[0], entities[1]],
    });

    const response = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}/${ids[0]}`,
      jwtToken: jwtToken,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ deleted: true });

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(ids);

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
      url: `/apps/${appName}/${environmentName}/${entityName}/${ids[1]}`,
      jwtToken: jwtToken,
    });
    expect(finalDeleteResponse.status).toBe(200);
    expect(await finalDeleteResponse.json()).toStrictEqual({ deleted: true });

    const entitiesFromDb1 = await helper.getEntitiesByIdFromDatabase(ids);

    expect(entitiesFromDb1).toBeArrayOfSize(0);

    const environment1 =
      await helper.getEnvironmentFromDbByName(environmentName);
    expect(environment1?.entities).toBeArrayOfSize(0);
  });
});
