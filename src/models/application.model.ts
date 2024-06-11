import mongoose, { Schema } from "mongoose";
import type { Environment } from "./environment.model";

export const ApplicationSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  environments: { type: Array, required: true },
  image: {
    type: String,
  },
  description: {
    type: String,
  },
  extras: {
    type: Object,
  },
});

export type Application = {
  // TODO rename this id to _id
  _id: string;
  name: string;
  environments: Environment[];
  image?: string | null;
  description?: string | null;
  extras?: Record<string, unknown>;
};

const Application = mongoose.model("Application", ApplicationSchema);
export default Application;
