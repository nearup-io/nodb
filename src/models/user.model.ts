import mongoose from "mongoose";
import type { Application } from "./application.model";

const { Schema } = mongoose;

export const TelegramSchema = new Schema(
  {
    id: { type: Number, required: true, index: true, unique: true },
    appName: { type: String, required: true },
    envName: { type: String, required: true },
  },
  { _id: false },
);

export const WhatsappSchema = new Schema(
  {
    id: { type: String, required: true, index: true, unique: true },
    appName: { type: String, required: true },
    envName: { type: String, required: true },
  },
  { _id: false },
);

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
  telegram: {
    type: TelegramSchema,
    required: false,
  },
  whatsapp: {
    type: WhatsappSchema,
    required: false,
  },
});

export type User = {
  email: string;
  applications: Application[];
  lastUse: Date;
  clerkUserId: string;
  telegram?: {
    id: number;
    appName: string;
    envName: string;
  };
};

const User = mongoose.model("User", UserSchema);
export default User;
