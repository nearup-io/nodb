import type { ObjectId } from "mongodb";
import mongoose, { Schema } from "mongoose";

const TokenSchema = new Schema(
  {
    key: { type: String, required: true },
    permission: { type: String, enum: ["ALL", "READ-ONLY"], required: true },
  },
  { _id: false },
);

type Token = {
  key: string;
  permission: "ALL" | "READ-ONLY";
};

export const EnvironmentSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  extras: {
    type: Object,
  },
  app: {
    type: String,
    required: false,
  },
  tokens: { type: [TokenSchema], default: [], required: true },
  entities: {
    type: [{ type: String }],
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
});

export type Environment = {
  _id: ObjectId;
  name: string;
  app?: string | null;
  extras?: Record<string, unknown>;
  tokens: Token[];
  entities: string[]; // only names/slugs ["my-entity", "movies"]
  description?: string | null;
};
const Environment = mongoose.model("Environment", EnvironmentSchema);
export default Environment;
