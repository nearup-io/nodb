import mongoose from "mongoose";
import Application from "../../models/application.model.ts";
import Environment from "../../models/environment.model.ts";
import Entity from "../../models/entity.model.ts";
import User from "../../models/user.model.ts";

abstract class BaseRepository {
  protected constructor() {}

  protected get applicationModel() {
    return Application;
  }

  protected get environmentModel() {
    return Environment;
  }

  protected get entityModel() {
    return Entity;
  }

  protected get userModel() {
    return User;
  }

  protected async transaction<T>(
    callback: (session: mongoose.mongo.ClientSession) => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        const result = await callback(session);
        await session.commitTransaction();
        return result; // Success, exit the function
      } catch (error) {
        await session.abortTransaction();
        if (attempt === maxRetries) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000),
        ); // Exponential backoff
      } finally {
        await session.endSession();
      }
    }

    throw new Error("Transaction failed after too many retries");
  }
}

export default BaseRepository;
