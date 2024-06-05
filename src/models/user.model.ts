import mongoose from "mongoose";
import type { Application } from "./application.model";

const { Schema } = mongoose;

export const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  applications: { type: Array, default: [] },
  lastUse: { type: Date, default: Date.now },
});

export type User = {
  email: string;
  applications: Application[];
  lastUse: Date;
};

const User = mongoose.model("User", UserSchema);
export default User;
