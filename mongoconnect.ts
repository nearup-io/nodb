import mongoose, { Mongoose } from "mongoose";

const mongodbUrl = Bun.env.MONGODB_URL;
if (!mongodbUrl) {
  console.error("Invalid mongodb url");
  process.exit(1);
}

declare global {
  var mongoconnect: Mongoose | null;
}

globalThis.mongoconnect ??= null;
const mongoconnect = async () => {
  console.log("Closing Mongoose...");
  await mongoose.connection.close();
  console.log("Connecting to Mongoose...");
  await mongoose.connect(mongodbUrl, {
    maxPoolSize: 2,
    autoIndex: false,
  });
  console.info("Connected to Mongoose");
};

export default mongoconnect;
