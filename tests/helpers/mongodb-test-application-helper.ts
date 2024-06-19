import { MongoClient } from "mongodb";
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
import * as R from "ramda";
import { BaseApplicationHelper } from "./base-application-helper.ts";
import type { ITestApplicationHelper } from "./IApplicationHelper.ts";
import { startApp } from "../../src/server.ts";

export class MongodbTestApplicationHelper
  extends BaseApplicationHelper
  implements ITestApplicationHelper
{
  private readonly mongoClient: MongoClient;
  private readonly databaseName: string;
  constructor() {
    super();
    this.mongoClient = new MongoClient(Bun.env.MONGODB_URL!);
    this.databaseName = Bun.env
      .MONGODB_URL!.split("/")
      .at(-1)!
      .split("?")
      .at(0)!;
  }

  async init(): Promise<void> {
    this.application = await startApp();
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

  async insertUser(
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

  async stopApplication(): Promise<void> {
    await this.cleanup();
  }

  async getEntitiesByIdFromDatabase(
    ids: string[],
    sortByProp: string = "model.prop",
  ): Promise<EntityType[]> {
    return Entity.find({ id: { $in: ids } })
      .select(["-__v", "-_id"])
      .sort(sortByProp)
      .lean();
  }

  async getEnvironmentFromDbByName(
    name: string,
  ): Promise<EnvironmentType | null> {
    const result = await Environment.findOne({ name }).select("-__v").lean();
    if (!result) return null;

    return { id: result._id.toString(), ...R.omit(["_id"], result) };
  }

  async getEnvironmentsFromDbByAppName(
    appName: string,
  ): Promise<EnvironmentType[]> {
    const environments = await Environment.find({ app: appName })
      .select("-__v")
      .lean();

    return environments.map((env) => {
      return { id: env._id.toString(), ...R.omit(["_id"], env) };
    });
  }

  async getAppFromDbByName(appName: string): Promise<AppType | null> {
    const result = await Application.findOne({
      name: appName,
    })
      .select("-__v")
      .lean();

    if (!result) return null;
    return { id: result._id.toString(), ...R.omit(["_id"], result) };
  }

  async getEntityFromDbById(id: string): Promise<EntityType | null> {
    return Entity.findById(id).select("-__v").lean();
  }

  async getUserAppsFromDbByEmail(email: string): Promise<string[]> {
    const user = await User.findOne({ email })
      .select<{ applications: string[] }>("applications")
      .lean();

    return user?.applications || [];
  }

  async getEnvironmentsFromAppName(name: string): Promise<string[]> {
    const app = await Application.findOne({ name }).select("-__v").lean();
    if (!app) return [];

    const environments = await Environment.find({
      _id: { $in: app.environments.map((x) => x._id.toString()) },
    });

    return environments.map((x) => x.name);
  }

  async deleteAppByName(name: string): Promise<void> {
    await Application.findOneAndDelete({ name });
  }

  async deleteAppsByNames(names: string[]): Promise<void> {
    await Application.deleteMany({
      name: { $in: names },
    });
  }

  async createAppWithEnvironmentEntitiesAndSubEntities({
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
