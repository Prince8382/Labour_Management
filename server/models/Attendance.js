import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    labour: { type: mongoose.Schema.Types.ObjectId, ref: "Labour", required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ["present", "absent", "half-day", "leave"], required: true },
    overtimeHours: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

attendanceSchema.index({ labour: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
