import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as R from "ramda";
import { deepEqual } from "assert";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("GET /apps/:appName/:envName/:entityName", () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  const appName = "memes-app-5";
  const environmentName = "environment-5";
  const entityName = "my-entity-5";
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
      appName: appName,
      environmentName,
      jwtToken,
      entityName,
      entities,
    });

    createdEntityIds = entityIds;
    appToken = aToken;
    envToken = eToken;
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  test("should return 404 NOT FOUND when environment does not exist for get entity by id", async () => {
    const response = await helper.executeGetRequest({
      url: `/apps/${appName}/not-existing-environment/${entityName}/${createdEntityIds[0]}`,
      jwtToken,
    });
    expect(response.status).toBe(404);
  });

  test("should return 404 NOT FOUND when entity does not exist for get entity by id", async () => {
    const response = await helper.executeGetRequest({
      url: `/apps/${appName}/not-existing-environment/${entityName}/not-existing-id`,
      jwtToken,
    });
    expect(response.status).toBe(404);
  });

  describe("Should return 401 UNAUTHORIZED", () => {
    test("when no token is present", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}`,
      });
      expect(response.status).toBe(401);

      const secondResponse = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${createdEntityIds[0]}`,
      });
      expect(secondResponse.status).toBe(401);
    });

    test("when application token (backend token) does not have permission for the application", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}-2/${environmentName}/${entityName}`,
        backendToken: appToken,
      });
      expect(response.status).toBe(401);

      const secondResponse = await helper.executeGetRequest({
        url: `/apps/${appName}-2/${environmentName}/${entityName}/${createdEntityIds[0]}`,
        backendToken: appToken,
      });
      expect(secondResponse.status).toBe(401);
    });

    test("when environment token (backend token) does not have permission for the environment", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/dev/${entityName}`,
        backendToken: envToken,
      });
      expect(response.status).toBe(401);

      const secondResponse = await helper.executeGetRequest({
        url: `/apps/${appName}/dev/${entityName}/${createdEntityIds[0]}`,
        backendToken: envToken,
      });
      expect(secondResponse.status).toBe(401);
    });
  });

  describe("Get by id endpoint", () => {
    const requestedEntity = entities[0];
    let requestedEntityId = "";

    beforeAll(() => {
      requestedEntityId = createdEntityIds[0]!;
    });

    test("Should return 200 OK and entity with expected data with JWT auth", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      deepEqual(await response.json(), {
        __meta: {
          self: `/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
        },
        id: requestedEntityId,
        ...requestedEntity,
      });
    });

    test("Should return 200 OK and entity with expected data with application token (backend token) auth", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
        backendToken: appToken,
      });
      expect(response.status).toBe(200);
      deepEqual(await response.json(), {
        __meta: {
          self: `/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
        },
        id: requestedEntityId,
        ...requestedEntity,
      });
    });

    test("Should return 200 OK and entity with expected data with environment token (backend token) auth", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
        backendToken: envToken,
      });
      expect(response.status).toBe(200);
      deepEqual(await response.json(), {
        __meta: {
          self: `/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
        },
        id: requestedEntityId,
        ...requestedEntity,
      });
    });

    test("Should return 200 OK and should apply the __only filter from query params", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}?__only=prop1`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      deepEqual(await response.json(), {
        __meta: {
          self: `/${appName}/${environmentName}/${entityName}/${requestedEntityId}`,
        },
        id: requestedEntityId,
        ...R.pick(["prop1"], requestedEntity),
      });
    });

    test("Should return 200 OK and not return the meta filters when __no_meta=true is added to the query params", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${requestedEntityId}?__only=prop1&__no_meta=true`,
        jwtToken,
      });
      expect(response.status).toBe(200);
      deepEqual(await response.json(), {
        id: requestedEntityId,
        ...R.pick(["prop1"], requestedEntity),
      });
    });
  });

  test("should return 200 OK and all entities of requested type with JWT auth", async () => {
    const response = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      jwtToken,
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

  test("should return 200 OK and all entities of requested type with application token (backend token) auth", async () => {
    const response = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      backendToken: appToken,
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

  test("should return 200 OK and all entities of requested type with environment token (backend token) auth", async () => {
    const response = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      backendToken: envToken,
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

  describe("Query params", () => {
    test("should return 200 OK and return only the requested props using __only query param", async () => {
      const response = await helper.executeGetRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}?__only=prop1,prop2`,
        jwtToken,
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
        jwtToken,
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
        jwtToken,
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
        jwtToken,
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
          jwtToken,
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
          jwtToken,
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
          jwtToken,
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
