import mongoose from "mongoose";

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
});

const User = mongoose.model("User", UserSchema);
export default User;
