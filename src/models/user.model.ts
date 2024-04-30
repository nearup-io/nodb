import mongoose from "mongoose";
import type { ObjectId } from "mongodb";

const { Schema } = mongoose;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  providers: { type: Array, default: [] },
  applications: { type: Array, default: [] },
  lastProvider: { type: String, default: "" },
  lastUse: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
export type User = {
  _id: ObjectId;
  email: string;
  providers: string[];
  applications: string[];
  lastProvider: string;
  lastUse: Date;
};
export default User;
