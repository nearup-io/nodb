import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { MongodbTestApplicationHelper } from "../helpers/mongodb-test-application-helper.ts";
import { deepEqual } from "assert";
import { defaultTestUser } from "../helpers/testUsers.ts";

describe("PATCH /apps/:appName/:envName/:entityName", () => {
  const helper = new MongodbTestApplicationHelper();
  let jwtToken = "";

  const patchAppName = "memes-app-2";
  const patchEnvironmentName = "environment-2";
  const patchEntityName = "myEntity";
  const patchSubEntityName = "mySubEntity";
  const entities: { prop: number }[] = [{ prop: 1 }, { prop: 2 }, { prop: 3 }];

  const subEntities: { subEntityProp: number }[] = [
    { subEntityProp: 1 },
    { subEntityProp: 2 },
    { subEntityProp: 3 },
  ];

  const createdEntityIds: string[] = [];
  const createdSubEntityIds: string[] = [];
  let entityIdWithSubEntity: string = "";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
    const {
      createdEntityIds: ids,
      createdSubEntityIds: subIds,
      entityIdWithSubEntity: entityId,
    } = await helper.createAppWithEnvironmentEntitiesAndSubEntities({
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
      await helper.getEntitiesByIdFromDatabase(createdEntityIds);

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

    const [entityFromDb] = await helper.getEntitiesByIdFromDatabase([
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

    const entitiesFromDb = await helper.getEntitiesByIdFromDatabase(
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
