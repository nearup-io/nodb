import { expect, test, describe, afterAll } from "bun:test";
import { TestApplicationStarter } from "./helpers/test-application-starter.ts";
import Application, {
  type Application as AppType,
} from "../src/models/application.model.ts";

const getAppFromDbByName = async (appName: string): Promise<AppType | null> => {
  return Application.findOne<AppType>({
    name: appName,
  })
    .select("-__v")
    .lean();
};

describe("All endpoints used for apps CRUD operations", async () => {
  const helper = new TestApplicationStarter();
  const app = helper.app;
  const jwtToken = await helper.generateJwtToken({
    email: "random@random.com",
    lastProvider: "",
    applications: [],
  });
  afterAll(async () => {
    await helper.stopApplication();
  });

  describe("POST /apps/:appName", async () => {
    const appName = "memes-app";

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

      test("when appName contains invalid characters", async () => {
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
      const dbResult = await getAppFromDbByName(appName);
      expect(dbResult).not.toBeNull();
      const { _id, environments, ...otherProps } = dbResult!;
      expect(_id).not.toBeUndefined();
      // one environment is automatically created
      expect(environments).toBeArray();
      expect(environments.length).toEqual(1);
      expect(otherProps).toEqual({
        description: "Memes app",
        image: "path/to/image.jpg",
        name: appName,
      });

      await Application.findOneAndDelete({ name: appName });
    });
  });

  describe("PATCH /apps/:appName", async () => {
    describe("Should return 400 BAD REQUEST", async () => {
      test("when appName prop in body exists and its too short", async () => {
        const shortAppName = "ap";
        const response = await app.request(`/apps/memes-app`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName: shortAppName,
          }),
        });
        expect(response.status).toBe(400);
      });

      test("when appName prop in body exists and contains invalid characters", async () => {
        const faultyAppName = "app_?test";

        const response = await app.request(`/apps/memes-app`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName: faultyAppName,
          }),
        });
        expect(response.status).toBe(400);

        const response1 = await app.request(`/apps/${faultyAppName}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName: "memes-app",
          }),
        });
        expect(response1.status).toBe(400);
      });

      test("when appName prop in body exists and it's the same as the existing appName", async () => {
        const appName = "testApp";
        const response = await app.request(`/apps/${appName}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: jwtToken,
          },
          body: JSON.stringify({
            appName,
          }),
        });
        expect(response.status).toBe(400);
      });
    });

    test("Should return 404 NOT FOUND and return proper body when app is not found", async () => {
      const appName = "random-app";
      const patchResponse = await app.request(`/apps/${appName}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          appName: "new-app-name",
          description: "new description",
          image: "path/to/image-new.jpg",
        }),
      });
      expect(patchResponse.status).toBe(200);
      expect(await patchResponse.json()).toEqual({ found: false });
    });

    test("Should return 200 OK and update app props in db properly", async () => {
      const appName = "random-app";
      const postResponse = await app.request(`/apps/${appName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          image: "path/to/image.jpg",
          description: "some description",
        }),
      });
      expect(postResponse.status).toBe(201);

      const patchResponse = await app.request(`/apps/${appName}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: jwtToken,
        },
        body: JSON.stringify({
          appName: "new-app-name",
          description: "new description",
          image: "path/to/image-new.jpg",
        }),
      });
      expect(patchResponse.status).toBe(200);
      expect(await patchResponse.json()).toEqual({ found: true });
      const dbResult = await getAppFromDbByName("new-app-name");
      expect(dbResult).not.toBeNull();
      const { _id, environments, ...otherProps } = dbResult!;
      expect(_id).not.toBeUndefined();
      // one environment is automatically created
      expect(environments).toBeArray();
      expect(environments.length).toEqual(1);
      expect(otherProps).toEqual({
        name: "new-app-name",
        description: "new description",
        image: "path/to/image-new.jpg",
      });

      await Application.findOneAndDelete({ name: "new-app-name" });
    });
  });
});
