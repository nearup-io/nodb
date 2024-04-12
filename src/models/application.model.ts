import mongoose, { Schema } from "mongoose";

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

const Application = mongoose.model("Application", ApplicationSchema);
export default Application;
