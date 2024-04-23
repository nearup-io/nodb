import type { Hono } from "hono";
import app from "../../src/app";
import type { USER_TYPE } from "../../src/utils/auth-utils.ts";
import { sign as jwt_sign } from "hono/jwt";
import { MongoClient } from "mongodb";

export class TestApplicationStarter {
  private readonly application: Hono;
  private readonly mongoClient: MongoClient;

  constructor() {
    this.application = app;
    this.mongoClient = new MongoClient(Bun.env.MONGODB_URL!);
  }

  get app(): Hono {
    return this.application;
  }

  public async generateJwtToken(userData: USER_TYPE): Promise<string> {
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
      const db = this.mongoClient.db("e2e_tests");

      // Drop the database
      await db.dropDatabase();

      console.log(`Database e2e_tests dropped successfully.`);
    } catch (error) {
      console.error("Error dropping database:", error);
    } finally {
      // Close the connection
      await this.mongoClient.close();
    }
  }
}
