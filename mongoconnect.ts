import mongoose, { type Mongoose } from "mongoose";

const mongodbUrl = Bun.env.MONGODB_URL;
if (!mongodbUrl) {
  console.error("Invalid mongodb url");
  process.exit(1);
}

declare global {
  var dbconn: Mongoose | null;
}

const mongoconnect: () => Promise<void> = async () => {
  const { MAX_POOL_SIZE } = Bun.env;
  try {
    console.log("Connecting to database...");
    if (globalThis.dbconn) {
      // close on "hot reload": bun --hot, or bun --watch
      await mongoose.connection.close();
    }
    globalThis.dbconn = await mongoose.connect(mongodbUrl, {
      maxPoolSize: MAX_POOL_SIZE ? parseInt(MAX_POOL_SIZE, 10) : 2,
      autoIndex: false,
    });
    console.log("Connected!");
    if (globalThis.dbconn) {
      console.log(
        `Number of connections: ${globalThis.dbconn.connections.length}`
      );
    }
  } catch (e) {
    console.log(e);
    await Bun.sleep(3000);
    return await mongoconnect();
  }
};

process.on("SIGINT", async () => {
  if (globalThis.dbconn) {
    try {
      await mongoose.connection.close();
      console.log("Database connection closed.");
    } catch (e) {
      console.error("Failed closing connection.", e);
    }
  }
  process.exit(0);
});

export default mongoconnect;
