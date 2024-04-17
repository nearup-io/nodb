import type { ObjectId } from "mongodb";
import mongoose, { Schema } from "mongoose";
import type { Environment } from "./environment.model";

const ApplicationSchema = new Schema({
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
  _id: ObjectId;
  name: string;
  environments: Environment[];
  image?: string;
  description?: string;
  extras?: Record<string, unknown>;
};

const Application = mongoose.model("Application", ApplicationSchema);
export default Application;
