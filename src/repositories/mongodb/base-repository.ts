import mongoose from "mongoose";
import {
  getApplicationModel,
  getEntityModel,
  getEnvironmentModel,
  getUserModel,
} from "../../connections/connect.ts";

abstract class BaseRepository {
  protected constructor(readonly conn: mongoose.Connection) {}

  protected get applicationModel() {
    return getApplicationModel(this.conn);
  }

  protected get environmentModel() {
    return getEnvironmentModel(this.conn);
  }

  protected get entityModel() {
    return getEntityModel(this.conn);
  }

  protected get userModel() {
    return getUserModel(this.conn);
  }

  protected async transaction<T>(
    callback: (session: mongoose.mongo.ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.conn.startSession();
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
