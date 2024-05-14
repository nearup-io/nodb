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
  providers: { type: Array, default: [] },
  applications: { type: Array, default: [] },
  lastProvider: { type: String, default: "" },
  lastUse: { type: Date, default: Date.now },
  telegramId: { type: Number, required: false },
});

export type User = {
  email: string;
  providers: string[];
  applications: Application[];
  lastProvider: string;
  lastUse: Date;
};

const User = mongoose.model("User", UserSchema);
export default User;
