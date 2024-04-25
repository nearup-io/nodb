import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { TestApplicationStarter } from "./helpers/test-application-starter.ts";
import Environment, {
  type Environment as EnvironmentType,
} from "../src/models/environment.model.ts";
import Application, {
  type Application as AppType,
} from "../src/models/application.model.ts";
import * as R from "ramda";

const getEnvironmentFromDbByName = async (
  name: string,
): Promise<Omit<EnvironmentType, "app"> | null> => {
  return Environment.findOne({ name }).select("-__v").lean();
};

const getApplicationByName = async (name: string): Promise<AppType | null> => {
  return Application.findOne({ name }).select("-__v").lean();
};

describe("Environment entity CRUD", async () => {
  const helper = new TestApplicationStarter();
  const app = helper.app;
  let jwtToken = "";

  beforeAll(async () => {
    jwtToken = await helper.generateJWTTokenAndUser({
      email: "random@random.com",
      lastProvider: "",
      applications: [],
    });
  });

  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("POST /apps/:appName/:envName", async () => {
    const appName = "test-app-name";

    afterEach(async () => {
      console.log("trying to clear up app");
      const deleteResponse = await app.request(`/apps/${appName}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
      });
      expect(deleteResponse.status).toBe(200);
      console.log("cleaned up app");
    });

    beforeEach(async () => {
      // create app
      const response = await app.request(`/apps/${appName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          image: "path/to/image.jpg",
          description: "Memes app",
        }),
      });

      expect(response.status).toBe(201);
      console.log("created up app");
    });

    test("should return 400 BAD REQUEST when environment for that app already exists", async () => {
      // first environment
      const environmentName = "environment";
      const firstEnvironmentResponse = await app.request(
        `/apps/${appName}/${environmentName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            description: "This is a staging environment",
          }),
        },
      );
      expect(firstEnvironmentResponse.status).toBe(201);

      // duplicate environment
      const secondEnvironmentResponse = await app.request(
        `/apps/${appName}/${environmentName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            description: "This is a staging environment",
          }),
        },
      );

      // expectations
      expect(secondEnvironmentResponse.status).toBe(400);

      const deleteResponse = await app.request(`/apps/${appName}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
      });
      expect(deleteResponse.status).toBe(200);
    });

    test("should return 201 CREATED and create the environment for the app", async () => {
      console.log("made it to the second test");
      const environmentName = "environment";
      const environmentResponse = await app.request(
        `/apps/${appName}/${environmentName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            description: "This is a staging environment",
          }),
        },
      );
      expect(environmentResponse.status).toBe(201);

      const environment = await getEnvironmentFromDbByName(environmentName);
      expect(environment).not.toBeNull();
      expect(R.keys(environment!)).toEqual([
        "_id",
        "name",
        "tokens",
        "entities",
        "description",
      ]);

      const { _id, tokens, ...props } = environment!;
      expect(_id).toBeDefined();
      expect(tokens).toBeArray();
      const [firstToken] = tokens;
      expect(firstToken.key).toBeString();
      expect(firstToken.permission).toBeString();

      expect(props).toEqual({
        description: "This is a staging environment",
        entities: [],
        name: "environment",
      });

      const application = await getApplicationByName(appName);
      expect(application).not.toBeNull();
      expect(application?.environments).toInclude(environmentName);

      const deleteResponse = await app.request(`/apps/${appName}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
      });
      expect(deleteResponse.status).toBe(200);
    });
  });
});
