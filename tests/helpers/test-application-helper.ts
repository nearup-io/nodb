import type { Hono } from "hono";
import { sign as jwt_sign } from "hono/jwt";
import { MongoClient } from "mongodb";
import app from "../../src/app";
import type { USER_TYPE } from "../../src/utils/auth-utils.ts";
import { type Entity as EntityType } from "../../src/models/entity.model.ts";
import { type Environment as EnvironmentType } from "../../src/models/environment.model.ts";
import { expect } from "bun:test";
import {
  getApplicationModel,
  getConnection,
  getEntityModel,
  getEnvironmentModel,
  getUserModel,
} from "../../src/connections/connect.ts";
import { type Application as AppType } from "../../src/models/application.model.ts";
import type { Connection } from "mongoose";

export class TestApplicationHelper {
  private readonly application: Hono;
  private readonly mongoClient: MongoClient;
  private readonly databaseName: string;
  private readonly connection: Connection;

  constructor(readonly dbName = "db1") {
    this.application = app;
    this.mongoClient = new MongoClient(Bun.env.NODB_db1!);
    this.databaseName = Bun.env.NODB_db1!.split("/").at(-1)!.split("?").at(0)!;
    this.connection = getConnection(this.dbName);
  }

  private getUrl(url: string): string {
    return `/${this.dbName}${url}`;
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

  public async generateJWTTokenAndUser(
    userData: USER_TYPE,
    createUser: boolean = true,
  ): Promise<string> {
    const userModel = getUserModel(this.connection);
    if (createUser) {
      await userModel.create({
        email: userData.email,
      });
    }
    return jwt_sign(userData, Bun.env.JWT_SECRET!);
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
    return this.app.request(this.getUrl(url), {
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
    return this.app.request(this.getUrl(url), {
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
    return this.app.request(this.getUrl(url), {
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
    return this.app.request(this.getUrl(url), {
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
    return this.app.request(this.getUrl(url), {
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
    return getEntityModel(this.connection)
      .find({ id: { $in: ids } })
      .select(["-__v", "-_id"])
      .sort(sortByProp)
      .lean();
  }

  public async getEnvironmentFromDbByName(
    name: string,
  ): Promise<EnvironmentType | null> {
    return getEnvironmentModel(this.connection)
      .findOne({ name })
      .select("-__v")
      .lean();
  }

  public async getEnvironmentsFromDbByAppName(
    appName: string,
  ): Promise<EnvironmentType[]> {
    return getEnvironmentModel(this.connection)
      .find({ app: appName })
      .select("-__v")
      .lean();
  }

  public async getAppFromDbByName(appName: string): Promise<AppType | null> {
    return getApplicationModel(this.connection)
      .findOne<AppType>({
        name: appName,
      })
      .select("-__v")
      .lean();
  }

  public async getEntityFromDbById(id: string): Promise<EntityType | null> {
    return getEntityModel(this.connection).findById(id).select("-__v").lean();
  }

  public async getUserAppsFromDbByEmail(email: string): Promise<string[]> {
    const user = await getUserModel(this.connection)
      .findOne({ email })
      .select<{ applications: string[] }>("applications")
      .lean();

    return user?.applications || [];
  }

  public async getEnvironmentsFromAppName(name: string): Promise<string[]> {
    const app = await getApplicationModel(this.connection)
      .findOne({ name })
      .select("-__v")
      .lean();
    if (!app) return [];

    const environments = await getEnvironmentModel(this.connection).find({
      _id: { $in: app.environments.map((x) => x._id.toString()) },
    });

    return environments.map((x) => x.name);
  }

  public async deleteAppByName(name: string): Promise<void> {
    await getApplicationModel(this.connection).findOneAndDelete({ name });
  }

  public async deleteAppsByNames(names: string[]): Promise<void> {
    await getApplicationModel(this.connection).deleteMany({
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
