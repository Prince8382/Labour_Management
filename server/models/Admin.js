import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "primary" },
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 40 },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
  },
  { timestamps: true },
);

export default mongoose.model("Admin", adminSchema);
