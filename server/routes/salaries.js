import { Router } from "express";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Labour from "../models/Labour.js";
import Payment from "../models/Payment.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "A valid month (YYYY-MM) is required." });
    }
    const [labours, attendance, payments] = await Promise.all([
      Labour.find().sort({ fullName: 1 }).lean(),
      Attendance.find({ date: new RegExp(`^${month}-`) }).lean(),
      Payment.find({ month }).lean(),
    ]);

    const byLabour = new Map();
    for (const record of attendance) {
      const current = byLabour.get(String(record.labour)) || {
        presentDays: 0,
        halfDays: 0,
        overtimeHours: 0,
      };
      if (record.status === "present") current.presentDays += 1;
      if (record.status === "half-day") current.halfDays += 1;
      current.overtimeHours += record.overtimeHours || 0;
      byLabour.set(String(record.labour), current);
    }
    const paidByLabour = new Map();
    for (const payment of payments) {
      const key = String(payment.labour);
      paidByLabour.set(key, (paidByLabour.get(key) || 0) + payment.amount);
    }
    res.json(
      labours.map((labour) => {
        const key = String(labour._id);
        const days = byLabour.get(key) || {
          presentDays: 0,
          halfDays: 0,
          overtimeHours: 0,
        };
        const overtimePay = Math.round((days.overtimeHours * labour.dailyWage) / 8);
        const earned =
          Math.round((days.presentDays + days.halfDays * 0.5) * labour.dailyWage) +
          overtimePay;
        const paid = paidByLabour.get(key) || 0;
        return {
          ...labour,
          presentDays: days.presentDays,
          halfDays: days.halfDays,
          overtimeHours: days.overtimeHours,
          overtimePay,
          earned,
          paid,
          balance: earned - paid,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.post("/payments", async (req, res, next) => {
  try {
    const { labourId, month, amount, paidDate, method, note = "" } = req.body;
    if (!mongoose.isValidObjectId(labourId)) {
      return res.status(400).json({ message: "A valid labour ID is required." });
    }
    const labourExists = await Labour.exists({ _id: labourId });
    if (!labourExists) return res.status(404).json({ message: "Labour not found." });
    const payment = await Payment.create({
      labour: labourId,
      month,
      amount,
      paidDate,
      method,
      note,
    });
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

export default router;
