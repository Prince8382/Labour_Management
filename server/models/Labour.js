import mongoose from "mongoose";

const labourSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    role: { type: String, required: true, trim: true, maxlength: 80 },
    dailyWage: { type: Number, required: true, min: 0 },
    joiningDate: { type: String, required: true },
    address: { type: String, trim: true, maxlength: 300, default: "" },
    emergencyContact: { type: String, trim: true, maxlength: 20, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

export default mongoose.model("Labour", labourSchema);
