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
  clerkUserId: { type: String, required: true, unique: true },
  lastUse: { type: Date, default: Date.now },
  telegramId: { type: Number, required: false },
});

export type User = {
  email: string;
  applications: Application[];
  lastUse: Date;
  clerkUserId: string;
};

const User = mongoose.model("User", UserSchema);
export default User;
