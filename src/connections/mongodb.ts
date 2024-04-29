import mongoose from "mongoose";
import config from "../config";

const connect = async (uri: string, options = {}) => {
  await mongoose.disconnect()
  const db = await mongoose
    .createConnection(
      uri,
      Object.assign({}, options, {
        maxPoolSize: config.mongodb.maxPoolSize,
        autoIndex: config.mongodb.autoIndex,
      })
    )
    .asPromise();
  if (Bun.env.NODE_ENV === "development") {
    mongoose.set("debug", true);
  }
  db.set("strictQuery", true);
  console.info("MongoDB connection succeeded!");

  // Graceful exit
  process.on("SIGINT", () => {
    db.close().then(() => {
      console.info("Mongoose connection disconnected through app termination!");
      process.exit(0);
    });
  });
  return db;
};

const dbConnection = async (
  uri: string,
  options = {}
): Promise<mongoose.Connection> => {
  try {
    const db = await connect(uri, options);
    return db;
  } catch (e) {
    const error = e as Error;
    if (Bun.env.NODE_ENV === "development") {
      console.error(`Error connecting to ${uri}:`, error.message);
    } else {
      console.error(
        `Error connecting to ${new URL(uri).hostname}:`,
        error.message
      );
    }
    await Bun.sleep(3000);
    const db = await dbConnection(uri, options);
    return db;
  }
};

export default dbConnection;
