import { MongoClient } from "mongodb";
import Entity, {
  type Entity as EntityType,
} from "../../src/models/entity.model.ts";
import Environment, {
  type Environment as EnvironmentType,
} from "../../src/models/environment.model.ts";
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
    if (createUser) {
      await User.create({
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
      .select(["-__v", "-_id", "-_embedding"])
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
  ): Promise<Omit<EnvironmentType, "entities" | "tokens">[]> {
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
}
