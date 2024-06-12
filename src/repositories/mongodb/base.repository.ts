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
  ): Promise<T> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      await session.endSession();
    }
  }
}

export default BaseRepository;
