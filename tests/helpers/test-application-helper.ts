import type { Hono } from "hono";
import { MongoClient } from "mongodb";
import app from "../../src/app";
import Entity, {
  type Entity as EntityType,
} from "../../src/models/entity.model.ts";
import Environment, {
  type Environment as EnvironmentType,
} from "../../src/models/environment.model.ts";
import { expect } from "bun:test";
import Application, {
  type Application as AppType,
} from "../../src/models/application.model.ts";
import User from "../../src/models/user.model.ts";
import type { TestUser } from "./testUsers.ts";

export class TestApplicationHelper {
  private readonly application: Hono;
  private readonly mongoClient: MongoClient;
  private readonly databaseName: string;
  constructor() {
    this.application = app;
    this.mongoClient = new MongoClient(Bun.env.MONGODB_URL!);
    this.databaseName = Bun.env
      .MONGODB_URL!.split("/")
      .at(-1)!
      .split("?")
      .at(0)!;
  }

  private async cleanup() {
    try {
      // Connect to the MongoDB server
      await this.mongoClient.connect();

      // Select the database
      const db = this.mongoClient.db(this.databaseName);

      // Drop the database
      await db.dropDatabase();

      console.log(`Database ${this.databaseName} dropped successfully.`);
    } catch (error) {
      console.error("Error dropping database:", error);
    } finally {
      // Close the connection
      await this.mongoClient.close();
    }
  }

  get app(): Hono {
    return this.application;
  }

  public async insertUser(
    userData: TestUser,
    createUser: boolean = true,
  ): Promise<string> {
    const userModel = User;

    if (createUser) {
      await userModel.create({
        clerkId: userData.userId,
        email: userData.email,
      });
    }

    return userData.jwt;
  }

  public async stopApplication(): Promise<void> {
    await this.cleanup();
  }

  public async executePostRequest({
    url,
    token,
    body,
  }: {
    url: string;
    token?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executePatchRequest({
    url,
    token,
    body,
  }: {
    url: string;
    token?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executePutRequest({
    url,
    token,
    body,
  }: {
    url: string;
    token?: string;
    body?: any;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  }

  public async executeGetRequest({
    url,
    token,
  }: {
    url: string;
    token?: string;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
    });
  }

  public async executeDeleteRequest({
    url,
    token,
  }: {
    url: string;
    token?: string;
  }): Promise<Response> {
    return this.app.request(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: token }),
      },
    });
  }

  public async getEntitiesByIdFromDatabase(
    ids: string[],
    sortByProp: string = "model.prop",
  ): Promise<EntityType[]> {
    return Entity.find({ id: { $in: ids } })
      .select(["-__v", "-_id"])
      .sort(sortByProp)
      .lean();
  }

  public async getEnvironmentFromDbByName(
    name: string,
  ): Promise<EnvironmentType | null> {
    return Environment.findOne({ name }).select("-__v").lean();
  }

  public async getEnvironmentsFromDbByAppName(
    appName: string,
  ): Promise<EnvironmentType[]> {
    return Environment.find({ app: appName }).select("-__v").lean();
  }

  public async getAppFromDbByName(appName: string): Promise<AppType | null> {
    return Application.findOne<AppType>({
      name: appName,
    })
      .select("-__v")
      .lean();
  }

  public async getEntityFromDbById(id: string): Promise<EntityType | null> {
    return Entity.findById(id).select("-__v").lean();
  }

  public async getUserAppsFromDbByEmail(email: string): Promise<string[]> {
    const user = await User.findOne({ email })
      .select<{ applications: string[] }>("applications")
      .lean();

    return user?.applications || [];
  }

  public async getEnvironmentsFromAppName(name: string): Promise<string[]> {
    const app = await Application.findOne({ name }).select("-__v").lean();
    if (!app) return [];

    const environments = await Environment.find({
      _id: { $in: app.environments.map((x) => x._id.toString()) },
    });

    return environments.map((x) => x.name);
  }

  public async deleteAppByName(name: string): Promise<void> {
    await Application.findOneAndDelete({ name });
  }

  public async deleteAppsByNames(names: string[]): Promise<void> {
    await Application.deleteMany({
      name: { $in: names },
    });
  }

  public async createAppWithEnvironmentEntitiesAndSubEntities({
    appName,
    token,
    environmentName,
    entityName,
    entities,
    subEntityName,
    subEntities,
  }: {
    appName: string;
    environmentName: string;
    token: string;
    entityName: string;
    entities: any[];
    subEntityName?: string;
    subEntities?: any[];
  }): Promise<{
    createdEntityIds: string[];
    createdSubEntityIds?: string[];
    entityIdWithSubEntity?: string;
  }> {
    const appResponse = await this.executePostRequest({
      url: `/apps/${appName}`,
      token,
      body: {
        image: "path/to/image.jpg",
        description: "Memes app",
      },
    });
    expect(appResponse.status).toBe(201);

    const environmentResponse = await this.executePostRequest({
      url: `/apps/${appName}/${environmentName}`,
      token,
      body: {
        description: "This is an environment",
      },
    });
    expect(environmentResponse.status).toBe(201);

    const entityResponse = await this.executePostRequest({
      url: `/apps/${appName}/${environmentName}/${entityName}`,
      token,
      body: entities,
    });
    expect(entityResponse.status).toBe(201);
    const { ids } = (await entityResponse.json()) as { ids: string[] };

    if (!!subEntityName && !!subEntities) {
      const entityIdWithSubEntity = ids[2];
      const subEntityResponse = await this.executePostRequest({
        url: `/apps/${appName}/${environmentName}/${entityName}/${entityIdWithSubEntity}/${subEntityName}`,
        token,
        body: subEntities,
      });
      expect(subEntityResponse.status).toBe(201);
      const { ids: subEntityIds } = (await subEntityResponse.json()) as {
        ids: string[];
      };
      return {
        createdEntityIds: ids,
        entityIdWithSubEntity: entityIdWithSubEntity,
        createdSubEntityIds: subEntityIds,
      };
    }

    return {
      createdEntityIds: ids,
    };
  }
}
