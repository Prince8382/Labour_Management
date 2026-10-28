import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    labour: { type: mongoose.Schema.Types.ObjectId, ref: "Labour", required: true },
    month: { type: String, required: true },
    amount: { type: Number, required: true, min: 1 },
    paidDate: { type: String, required: true },
    method: { type: String, enum: ["cash", "bank", "upi"], required: true },
    note: { type: String, trim: true, maxlength: 250, default: "" },
  },
  { timestamps: true },
);

paymentSchema.index({ labour: 1, month: 1 });

export default mongoose.model("Payment", paymentSchema);
