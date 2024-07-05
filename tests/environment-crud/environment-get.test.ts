import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Environment as EnvironmentType } from "../../src/models/environment.model.ts";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";
import { deepEqual } from "assert";

describe("GET /apps/:appName/:envName", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";
  const appName = "test-app-name";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  test("should return 404 NOT FOUND when environment is not found", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);

    const getResponse = await helper.executeGetRequest({
      url: `/apps/${appName}/not-existing-environment`,
      jwtToken: jwtToken,
    });

    expect(getResponse.status).toBe(404);

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });

  test("should return 200 OK and environment", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const environmentName = "environment";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const getResponse = await helper.executeGetRequest({
      url: `/apps/${appName}/${environmentName}`,
      jwtToken: jwtToken,
    });

    expect(getResponse.status).toBe(200);

    const body = (await getResponse.json()) as Omit<EnvironmentType, "app">;

    deepEqual(
      R.keys(body).sort(),
      ["id", "name", "description", "tokens", "entities"].sort(),
    );

    const { id, tokens, ...props } = body;

    expect(id).toBeString();
    expect(tokens).toBeArray();

    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const deleteAppResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      jwtToken: jwtToken,
    });
    expect(deleteAppResponse.status).toBe(200);
  });
});
