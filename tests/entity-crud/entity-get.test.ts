import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TestApplicationHelper } from "../helpers/test-application-helper.ts";
import * as R from "ramda";
import { deepEqual } from "assert";
import { defaultTestUser } from "../helpers/testUsers.ts";

describe("GET /apps/:appName/:envName/:entityName", () => {
  const helper = new TestApplicationHelper();
  let jwtToken = "";

  const appName = "memes-app-5";
  const environmentName = "environment-5";
  const entityName = "my-entity-5";
  const subEntityName = "my-sub-entity-5";
  const entities: {
    prop1: number;
    prop2: number;
    prop3: number;
    prop4: number;
  }[] = [
    { prop1: 1, prop2: 1, prop3: 1, prop4: 1 },
    { prop1: 2, prop2: 2, prop3: 2, prop4: 2 },
    { prop1: 3, prop2: 3, prop3: 3, prop4: 3 },
    { prop1: 4, prop2: 4, prop3: 4, prop4: 4 },
    { prop1: 5, prop2: 5, prop3: 5, prop4: 5 },
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
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
    const {
      createdEntityIds: ids,
      createdSubEntityIds: subIds,
      entityIdWithSubEntity: entityId,
    } = await helper.createAppWithEnvironmentEntitiesAndSubEntities({
      appName: appName,
      environmentName,
      token: jwtToken,
      entityName,
      subEntityName,
      entities,
      subEntities,
    });

    createdEntityIds.push(...ids);
    createdSubEntityIds.push(...subIds!);
    entityIdWithSubEntity = entityId!;
  });

  afterAll(async () => {
    await helper.stopApplication();
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

    test("Should return 200 OK and should apply the __only filter from query params", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}?__only=prop1`,
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
        ...R.pick(["prop1"], requestedEntity),
      });
    });

    test("Should return 200 OK and not return the meta filters when __no_meta=true is added to the query params", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}?__only=prop1&__no_meta=true`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);
      deepEqual(await response.json(), {
        id: requestedEntityId,
        ...R.pick(["prop1"], requestedEntity),
      });
    });
  });

  test("should return 200 OK and all entities of requested type", async () => {
    const response = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      token: jwtToken,
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    const keys = R.keys(body);
    expect(keys).toBeArrayOfSize(2);
    deepEqual(keys, [entityName, "__meta"]);

    deepEqual(body["__meta"], {
      current_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=10`,
      items: entities.length,
      page: 1,
      pages: 1,
      totalCount: entities.length,
    });

    deepEqual(
      body[entityName],
      entities.map((entity, index) => {
        return {
          id: createdEntityIds[index],
          __meta: {
            self: `/${appName}/${environmentName}/${entityName}/${createdEntityIds[index]}`,
          },
          ...entity,
        };
      }),
    );
  });

  test("should return 200 OK and all entities of requested sub entity types", async () => {
    const response = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}`,
      token: jwtToken,
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    const keys = R.keys(body);
    expect(keys).toBeArrayOfSize(2);
    deepEqual(keys, [subEntityName, "__meta"]);

    deepEqual(body["__meta"], {
      current_page: `/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}?__page=1&__per_page=10`,
      items: subEntities.length,
      page: 1,
      pages: 1,
      totalCount: subEntities.length,
    });

    deepEqual(
      body[subEntityName],
      subEntities.map((subEntity, index) => {
        return {
          id: createdSubEntityIds[index],
          __meta: {
            self: `/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}/${createdSubEntityIds[index]}`,
          },
          ...subEntity,
        };
      }),
    );
  });

  describe("Query params", () => {
    test("should return 200 OK and return only the requested props using __only query param", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}?__only=prop1,prop2`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);

      const body = await response.json();
      const keys = R.keys(body);
      expect(keys).toBeArrayOfSize(2);
      deepEqual(keys, [entityName, "__meta"]);

      deepEqual(body["__meta"], {
        current_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=10&__only=${encodeURIComponent("prop1,prop2")}`,
        items: entities.length,
        page: 1,
        pages: 1,
        totalCount: entities.length,
      });

      deepEqual(
        body[entityName],
        entities.map((entity, index) => {
          return {
            id: createdEntityIds[index],
            __meta: {
              self: `/${appName}/${environmentName}/${entityName}/${createdEntityIds[index]}`,
            },
            ...R.pick(["prop1", "prop2"], entity),
          };
        }),
      );
    });

    test("should return 200 OK and not return any meta when using __no_meta query param", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}?__no_meta=true`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);

      const body = await response.json();
      const keys = R.keys(body);
      expect(keys).toBeArrayOfSize(2);
      deepEqual(keys, [entityName, "__meta"]);

      deepEqual(body["__meta"], {
        current_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=10&__no_meta=true`,
        items: entities.length,
        page: 1,
        pages: 1,
        totalCount: entities.length,
      });

      deepEqual(
        body[entityName],
        entities.map((entity, index) => {
          return {
            id: createdEntityIds[index],
            ...entity,
          };
        }),
      );
    });

    test("should return 200 OK and sort by requested param using __sort_by query param", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}?__sort_by=prop1`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);

      const body = await response.json();
      const keys = R.keys(body);
      expect(keys).toBeArrayOfSize(2);
      deepEqual(keys, [entityName, "__meta"]);

      deepEqual(body["__meta"], {
        current_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=10&__sort_by=prop1`,
        items: entities.length,
        page: 1,
        pages: 1,
        totalCount: entities.length,
      });

      deepEqual(
        body[entityName],
        entities.map((entity, index) => {
          return {
            id: createdEntityIds[index],
            __meta: {
              self: `/${appName}/${environmentName}/${entityName}/${createdEntityIds[index]}`,
            },
            ...entity,
          };
        }),
      );
    });

    test("should return 200 OK and sort by requested param using __sort_by_desc query param", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}?__sort_by_desc=prop1`,
        token: jwtToken,
      });
      expect(response.status).toBe(200);

      const body = await response.json();
      const keys = R.keys(body);
      expect(keys).toBeArrayOfSize(2);
      deepEqual(keys, [entityName, "__meta"]);

      deepEqual(body["__meta"], {
        current_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=10&__sort_by_desc=prop1`,
        items: entities.length,
        page: 1,
        pages: 1,
        totalCount: entities.length,
      });

      deepEqual(
        body[entityName],
        [...entities].reverse().map((entity, index) => {
          const reversedEntityIds = [...createdEntityIds].reverse();
          return {
            id: reversedEntityIds[index],
            __meta: {
              self: `/${appName}/${environmentName}/${entityName}/${reversedEntityIds[index]}`,
            },
            ...entity,
          };
        }),
      );
    });

    describe("Pagination", () => {
      test("should return 200 OK and return the requested amount of items on a page + specific page", async () => {
        const response = await helper.executeGetRequest({
          url: `/apps/${appName}/${environmentName}/${entityName}?__per_page=2&__page=1`,
          token: jwtToken,
        });
        expect(response.status).toBe(200);

        const body = await response.json();
        const keys = R.keys(body);
        expect(keys).toBeArrayOfSize(2);
        deepEqual(keys, [entityName, "__meta"]);

        deepEqual(body["__meta"], {
          current_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=2`,
          first_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=2`,
          items: 2,
          last_page: `/${appName}/${environmentName}/${entityName}?__page=3&__per_page=2`,
          next: 2,
          next_page: `/${appName}/${environmentName}/${entityName}?__page=2&__per_page=2`,
          page: 1,
          pages: 3,
          totalCount: entities.length,
        });

        deepEqual(
          body[entityName],
          R.take(2, entities).map((entity, index) => {
            return {
              id: createdEntityIds[index],
              __meta: {
                self: `/${appName}/${environmentName}/${entityName}/${createdEntityIds[index]}`,
              },
              ...entity,
            };
          }),
        );
      });

      test("should return 200 OK and return the requested amount of items on a page + second page", async () => {
        const response = await helper.executeGetRequest({
          url: `/apps/${appName}/${environmentName}/${entityName}?__per_page=2&__page=2`,
          token: jwtToken,
        });
        expect(response.status).toBe(200);

        const body = await response.json();
        const keys = R.keys(body);
        expect(keys).toBeArrayOfSize(2);
        deepEqual(keys, [entityName, "__meta"]);

        deepEqual(body["__meta"], {
          current_page: `/${appName}/${environmentName}/${entityName}?__page=2&__per_page=2`,
          first_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=2`,
          items: 2,
          last_page: `/${appName}/${environmentName}/${entityName}?__page=3&__per_page=2`,
          next: 3,
          next_page: `/${appName}/${environmentName}/${entityName}?__page=3&__per_page=2`,
          page: 2,
          pages: 3,
          previous: 1,
          previous_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=2`,
          totalCount: entities.length,
        });

        deepEqual(body[entityName], [
          {
            id: createdEntityIds[2],
            __meta: {
              self: `/${appName}/${environmentName}/${entityName}/${createdEntityIds[2]}`,
            },
            ...entities[2],
          },
          {
            id: createdEntityIds[3],
            __meta: {
              self: `/${appName}/${environmentName}/${entityName}/${createdEntityIds[3]}`,
            },
            ...entities[3],
          },
        ]);
      });

      test("should return 200 OK and return the requested amount of items on a page + last page", async () => {
        const response = await helper.executeGetRequest({
          url: `/apps/${appName}/${environmentName}/${entityName}?__per_page=2&__page=3`,
          token: jwtToken,
        });
        expect(response.status).toBe(200);

        const body = await response.json();
        const keys = R.keys(body);
        expect(keys).toBeArrayOfSize(2);
        deepEqual(keys, [entityName, "__meta"]);

        deepEqual(body["__meta"], {
          current_page: `/${appName}/${environmentName}/${entityName}?__page=3&__per_page=2`,
          first_page: `/${appName}/${environmentName}/${entityName}?__page=1&__per_page=2`,
          items: 1,
          last_page: `/${appName}/${environmentName}/${entityName}?__page=3&__per_page=2`,
          page: 3,
          pages: 3,
          previous: 2,
          previous_page: `/${appName}/${environmentName}/${entityName}?__page=2&__per_page=2`,
          totalCount: entities.length,
        });

        deepEqual(body[entityName], [
          {
            id: createdEntityIds[4],
            __meta: {
              self: `/${appName}/${environmentName}/${entityName}/${createdEntityIds[4]}`,
            },
            ...entities[4],
          },
        ]);
      });
    });
  });
});
