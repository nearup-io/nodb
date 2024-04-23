import { expect, test, describe, afterAll } from "bun:test";
import { TestApplicationStarter } from "./helpers/test-application-starter.ts";
import Application, {
  type Application as AppType,
} from "../src/models/application.model.ts";

const getAppFromDb = async (appName: string): Promise<AppType | null> => {
  return Application.findOne<AppType>({
    name: appName,
  })
    .select("-__v")
    .lean();
};

describe("POST /apps/:appName", async () => {
  const helper = new TestApplicationStarter();
  const app = helper.app;
  const jwtToken = await helper.generateJwtToken({
    email: "random@random.com",
    lastProvider: "",
    applications: [],
  });
  const appName = "memes-app";

  afterAll(async () => {
    await helper.stopApplication();
  });

  test("Should return 401 UNAUTHORIZED when no token is present", async () => {
    const response = await app.request(`/apps/${appName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: "path/to/image.jpg",
        description: "Memes app",
      }),
    });
    expect(response.status).toBe(401);
  });

  describe("Should return 400 BAD REQUEST", async () => {
    test("when appName is too short", async () => {
      const shortAppName = "ap";
      const response = await app.request(`/apps/${shortAppName}`, {
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
      expect(response.status).toBe(400);
    });

    test("when appName is too short", async () => {
      const faultyAppName = "app_?test";
      const response = await app.request(`/apps/${faultyAppName}`, {
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
      expect(response.status).toBe(400);
    });

    test("when appName already exists", async () => {
      const newApp: Omit<AppType, "_id"> = {
        name: "uniqueAppName",
        environments: [],
      };
      const appInDb = await Application.create(newApp);
      const response = await app.request(`/apps/${newApp.name}`, {
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
      expect(response.status).toBe(400);
      await Application.findByIdAndDelete(appInDb._id);
    });
  });

  test("Should return 201 OK and create an app", async () => {
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
    expect(await response.json()).toEqual({ success: "success" });
    const dbResult = await getAppFromDb(appName);
    expect(dbResult).not.toBeNull();
    const { _id, environments, ...otherProps } = dbResult!;
    expect(_id).not.toBeUndefined();
    // one environment is automatically created and is equal to the node environment
    expect(environments).toBeArray();
    expect(environments.length).toEqual(1);
    expect(otherProps).toEqual({
      description: "Memes app",
      image: "path/to/image.jpg",
      name: appName,
    });
  });
});
