import mongoose, { Schema } from "mongoose";

export interface IEntity {
  id: string;
  type: string;
  model: Record<string, unknown>;
  extras?: Record<string, unknown>;
  ancestors?: string[];
}

const EntitySchema = new Schema(
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
      // type: Model<unknown>,
      required: false,
    },
  },
  { _id: false }
);

const Entity = mongoose.model("Entity", EntitySchema);
export default Entity;
