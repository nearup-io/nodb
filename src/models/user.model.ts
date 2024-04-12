import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema({
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
});

const User = mongoose.model("User", userSchema);
export default User;
