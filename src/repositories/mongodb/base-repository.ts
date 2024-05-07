import mongoose from "mongoose";

abstract class BaseRepository {
  protected constructor(readonly conn: mongoose.Connection) {}

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
