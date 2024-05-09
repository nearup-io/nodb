import mongoose, { Schema } from "mongoose";

export const EntitySchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    extras: {
      type: Object,
      required: false,
    },
    ancestors: {
      type: [{ type: String }],
      required: false,
    },
    model: {
      type: Object,
      required: false,
    },
    embedding: {
      type: [{ type: Number }],
      required: false,
    },
  },
  { _id: false },
);

export type Entity = {
  id: string;
  type: string;
  model: Record<string, unknown>;
  extras?: Record<string, unknown>;
  ancestors?: string[] | null;
  embedding?: number[] | null;
};

const Entity = mongoose.model("Entity", EntitySchema);
export default Entity;
