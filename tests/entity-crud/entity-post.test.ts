import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TestApplicationHelper } from "../helpers/test-application-helper.ts";
import * as R from "ramda";
import { deepEqual } from "assert";
import { defaultTestUser } from "../helpers/testUsers.ts";

describe("POST /apps/:appName/:envName/:entityName", async () => {
  const helper = new TestApplicationHelper();
  let jwtToken = "";

  const appName = "memes-app";
  const environmentName = "environment";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
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

    const entities = await helper.getEntitiesByIdFromDatabase(ids);
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

    const environment =
      await helper.getEnvironmentFromDbByName(environmentName);
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

    const entities = await helper.getEntitiesByIdFromDatabase(ids);
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

    const environment =
      await helper.getEnvironmentFromDbByName(environmentName);
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
