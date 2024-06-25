import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Environment as EnvironmentType } from "../../src/models/environment.model.ts";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("POST /apps/:appName/:envName", async () => {
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

  test("should return 400 BAD REQUEST when environment for that app already exists", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });

    expect(response.status).toBe(201);
    // first environment
    const environmentName = "environment";
    const firstEnvironmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      token: jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(firstEnvironmentResponse.status).toBe(201);

    // duplicate environment
    const secondEnvironmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      token: jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });

    // expectations
    expect(secondEnvironmentResponse.status).toBe(400);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });

  test("should return 201 CREATED and create the environment for the app", async () => {
    const response = await helper.executePostRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(response.status).toBe(201);
    const environmentName = "environment-1";
    const environmentResponse = await helper.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      token: jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const environment = (await helper.getEnvironmentFromDbByName(
      environmentName,
    )) as Omit<EnvironmentType, "app"> | null;
    expect(environment).not.toBeNull();
    expect(R.keys(environment!)).toEqual([
      "id",
      "name",
      "tokens",
      "entities",
      "description",
    ]);

    const { id, tokens, ...props } = environment!;
    expect(id).toBeDefined();
    expect(tokens).toBeArray();
    const [firstToken] = tokens;
    expect(firstToken.key).toBeString();
    expect(firstToken.permission).toBeString();

    expect(props).toEqual({
      description: "This is a staging environment",
      entities: [],
      name: environmentName,
    });

    const environments = await helper.getEnvironmentsFromAppName(appName);
    expect(environments).toContain(environmentName);

    const deleteResponse = await helper.executeDeleteRequest({
      url: `/apps/${appName}`,
      token: jwtToken,
    });
    expect(deleteResponse.status).toBe(200);
  });
});
