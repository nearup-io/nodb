import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type Application as AppType } from "../../src/models/application.model.ts";
import * as R from "ramda";
import {
  createTestApplicationHelperFactory,
  defaultTestUser,
} from "../helpers";

describe("App endpoint DELETE", async () => {
  const helper = createTestApplicationHelperFactory();
  let jwtToken = "";

  beforeAll(async () => {
    await helper.init();
    jwtToken = await helper.insertUser(defaultTestUser);
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  test("Should return 401 FORBIDDEN when no JWT token or backend token is provided", async () => {
    const response = await helper.executeDeleteRequest({
      url: `/apps/random-app`,
    });

    expect(response.status).toBe(401);
  });

  test("Should return 401 FORBIDDEN when backend token does not have permissions towards the app", async () => {
    const appForDeletion: Omit<AppType, "id" | "environments" | "tokens"> = {
      name: "test-app-name",
      image: "path/to/image-1.jpg",
      description: "description 1",
    };

    const postResponse = await helper.executePostRequest({
      url: `/apps/${appForDeletion.name}`,
      body: R.omit(["name"], appForDeletion),
    });

    expect(postResponse.status).toBe(201);
    const token = (await postResponse.json()).tokens[0].key as string;

    const response = await helper.executeDeleteRequest({
      url: `/apps/random-app`,
      backendToken: token,
    });

    expect(response.status).toBe(401);
  });

  test("should return 200 OK {found: false} when app is not found", async () => {
    const response = await helper.executeDeleteRequest({
      url: `/apps/not-found-name`,
      jwtToken: jwtToken,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ found: false });
  });

  test("should remove all environments, entities and remove the app from the user", async () => {
    const appForDeletion: Omit<AppType, "id" | "environments" | "tokens"> = {
      name: "app-name-1",
      image: "path/to/image-1.jpg",
      description: "description 1",
    };

    const postResponse = await helper.executePostRequest({
      url: `/apps/${appForDeletion.name}`,
      jwtToken: jwtToken,
      body: R.omit(["name"], appForDeletion),
    });

    expect(postResponse.status).toBe(201);

    const environmentName = "environment";
    const envResponse = await helper.executePostRequest({
      url: `/apps/${appForDeletion.name}/${environmentName}`,
      jwtToken: jwtToken,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(envResponse.status).toBe(201);
    const entityName = "todo";
    const entityResponse = await helper.executePostRequest({
      url: `/apps/${appForDeletion.name}/${environmentName}/${entityName}`,
      jwtToken: jwtToken,
      body: [
        { title: "Grocery Shopping", completed: false, priority: "medium" },
      ],
    });
    expect(entityResponse.status).toBe(201);
    const [createdEntityId] = (
      (await entityResponse.json()) as { ids: string[] }
    ).ids;

    const response = await helper.executeDeleteRequest({
      url: `/apps/${appForDeletion.name}`,
      jwtToken: jwtToken,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ found: true });

    expect(await helper.getEntityFromDbById(createdEntityId)).toBeNull();

    const environmentsForApp = await helper.getEnvironmentsFromDbByAppName(
      appForDeletion.name,
    );
    expect(environmentsForApp).toBeArrayOfSize(0);
    expect(
      await helper.getUserAppsFromDbByEmail(defaultTestUser.email),
    ).toBeArrayOfSize(0);
  });

  test("should remove all environments, entities and remove the with the token auth", async () => {
    const appForDeletion: Omit<AppType, "id" | "environments" | "tokens"> = {
      name: "app-name-2",
      image: "path/to/image-1.jpg",
      description: "description 1",
    };

    const postResponse = await helper.executePostRequest({
      url: `/apps/${appForDeletion.name}`,
      body: R.omit(["name"], appForDeletion),
    });

    expect(postResponse.status).toBe(201);
    const token = (await postResponse.json()).tokens[0].key as string;
    const environmentName = "environment";
    const envResponse = await helper.executePostRequest({
      url: `/apps/${appForDeletion.name}/${environmentName}`,
      backendToken: token,
      body: {
        description: "This is a staging environment",
      },
    });
    expect(envResponse.status).toBe(201);
    const entityName = "todo";
    const entityResponse = await helper.executePostRequest({
      url: `/apps/${appForDeletion.name}/${environmentName}/${entityName}`,
      backendToken: token,
      body: [
        { title: "Grocery Shopping", completed: false, priority: "medium" },
      ],
    });
    expect(entityResponse.status).toBe(201);
    const [createdEntityId] = (
      (await entityResponse.json()) as { ids: string[] }
    ).ids;

    const response = await helper.executeDeleteRequest({
      url: `/apps/${appForDeletion.name}`,
      jwtToken: jwtToken,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ found: true });

    expect(await helper.getEntityFromDbById(createdEntityId)).toBeNull();

    const environmentsForApp = await helper.getEnvironmentsFromDbByAppName(
      appForDeletion.name,
    );
    expect(environmentsForApp).toBeArrayOfSize(0);
    expect(
      await helper.getUserAppsFromDbByEmail(defaultTestUser.email),
    ).toBeArrayOfSize(0);
  });
});
