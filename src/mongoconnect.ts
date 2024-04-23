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
    if (globalThis.dbconn) {
      // close on "hot reload": bun --hot, or bun --watch
      console.log("Closing mongoose...");
      await globalThis.dbconn.connection.close();
    }

    globalThis.dbconn = await mongoose.connect(mongodbUrl, {
      maxPoolSize: MAX_POOL_SIZE ? parseInt(MAX_POOL_SIZE, 10) : 2,
      // create all indexes automatically
      autoIndex: true,
    });
    console.log("Connected to database!");
  } catch (e) {
    console.log(e);
    await Bun.sleep(3000);
    return await mongoconnect();
  }
};

process.on("SIGINT", async () => {
  if (globalThis.dbconn) {
    try {
      await globalThis.dbconn.connection.close();
      console.log("Database connection closed.");
    } catch (e) {
      console.error("Failed closing connection.", e);
    }
  }
  process.exit(0);
});

export default mongoconnect;
