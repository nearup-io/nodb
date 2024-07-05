import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as R from "ramda";
import { deepEqual } from "assert";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("POST /apps/:appName/:envName/:entityName", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  const appName = "memes-app";
  const environmentName = "environment";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
    const appResponse = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(appResponse.status).toBe(201);

    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
      body: {
        description: "This is an environment",
      },
    });
    expect(environmentResponse.status).toBe(201);
  });

  afterAll(async () => {
    await helper.stopApplication();
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
        jwtToken: jwtToken,
      });
      expect(response.status).toBe(400);

      const response1 = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}/entityName`,
        jwtToken: jwtToken,
        body: {},
      });
      expect(response1.status).toBe(400);
    });

    test("when url params are not valid", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}/${environmentName}/entityName/:randomId`,
        jwtToken: jwtToken,
        body: [{ prop: "value" }],
      });
      expect(response.status).toBe(404);
    });

    test("when environment does not exist", async () => {
      const response = await helper.executePostRequest({
        url: `/apps/${appName}/not-existing-environment/entityName`,
        jwtToken: jwtToken,
        body: [{ prop: "value" }],
      });
      expect(response.status).toBe(400);
    });
  });

  test("should return 201 CREATED and create entity", async () => {
    const entityName = "myEntity";
    const response = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      jwtToken: jwtToken,
      body: [{ prop: 1 }, { prop: 2 }, { prop: 3 }],
    });
    expect(response.status).toBe(201);
    const { ids } = (await response.json()) as { ids: string[] };
    expect(ids).toBeArrayOfSize(3);
    expect(ids.at(0)).toBeString();

    const entities = await helper.getEntitiesByIdFromDatabase(ids);
    deepEqual(R.keys(entities.at(0)!).sort(), ["id", "type", "model"].sort());

    const entitiesWithoutId = entities.map((entity) => {
      expect(entity.id).toBeString();
      return R.omit(["id"], entity);
    });

    deepEqual(entitiesWithoutId, [
      {
        model: {
          prop: 1,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          prop: 2,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
      {
        model: {
          prop: 3,
        },
        type: `${appName}/${environmentName}/${entityName}`,
      },
    ]);

    const environment =
      await helper.getEnvironmentFromDbByName(environmentName);
    expect(environment).not.toBeNull();
    expect(environment?.entities).toStrictEqual([entityName]);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      jwtToken: jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });
});
