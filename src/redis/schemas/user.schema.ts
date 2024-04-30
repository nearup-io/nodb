import { Schema } from "redis-om";

const userSchema = new Schema("user", {
  _id: { type: "string" },
  email: { type: "string", indexed: true },
  providers: { type: "string[]" },
  applications: { type: "string[]" },
  lastProvider: { type: "string[]" },
  lastUse: { type: "date" },
});

export default userSchema;
