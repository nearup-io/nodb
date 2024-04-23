import type { Hono } from "hono";
import app from "../../src/app";
import type { USER_TYPE } from "../../src/utils/auth-utils.ts";
import { sign as jwt_sign } from "hono/jwt";
import { MongoClient } from "mongodb";
import User from "../../src/models/user.model.ts";
import Application from "../../src/models/application.model.ts";

export class TestApplicationStarter {
  private readonly application: Hono;
  constructor() {
    this.application = app;
    // TODO figure out a proper solution for this
    Application.ensureIndexes().then(() => console.log("indexes pushed"));
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
    const mongoClient = new MongoClient(Bun.env.MONGODB_URL!);
    try {
      // Connect to the MongoDB server
      await mongoClient.connect();

      // Select the database
      const db = mongoClient.db("e2e_tests");

      // Drop the database
      await db.dropDatabase();

      console.log(`Database e2e_tests dropped successfully.`);
    } catch (error) {
      console.error("Error dropping database:", error);
    } finally {
      // Close the connection
      await mongoClient.close();
    }
  }
}
