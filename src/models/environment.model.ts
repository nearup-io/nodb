import type { ObjectId } from "mongodb";
import mongoose, { Schema } from "mongoose";

const TokenSchema = new Schema(
  {
    key: { type: String },
    permission: { type: String, enum: ["ALL", "READ-ONLY"] },
  },
  { _id: false },
);

const EnvironmentSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  extras: {
    type: Object,
  },
  app: {
    type: String,
  },
  tokens: { type: [TokenSchema], default: [] },
  entities: {
    type: [{ type: String }],
    required: false,
  },
  description: {
    type: String,
  },
});

export type Environment = {
  _id: ObjectId;
  name: string;
  app: string;
  extras?: Record<string, unknown>;
  tokens: Record<string, unknown>[];
  entities?: string[]; // only names/slugs ["my-entity", "movies"]
  description: string;
};
const Environment = mongoose.model("Environment", EnvironmentSchema);
export default Environment;
