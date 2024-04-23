import type { Hono } from "hono";
import app from "../../src/app";
import type { USER_TYPE } from "../../src/utils/auth-utils.ts";
import { sign as jwt_sign } from "hono/jwt";
import { MongoClient } from "mongodb";
import User from "../../src/models/user.model.ts";

export class TestApplicationStarter {
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

  get app(): Hono {
    return this.application;
  }

  public async generateJwtToken(userData: USER_TYPE): Promise<string> {
    await User.create({ email: userData.email });
    return jwt_sign(userData, Bun.env.JWT_SECRET!);
  }

  public async stopApplication(): Promise<void> {
    await this.cleanup();
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
}
