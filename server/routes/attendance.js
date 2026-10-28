import { Router } from "express";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Labour from "../models/Labour.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "A valid date (YYYY-MM-DD) is required." });
    }
    const records = await Attendance.find({ date }).lean();
    res.json(records);
  } catch (error) {
    next(error);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({ message: "A valid month (YYYY-MM) is required." });
    }

    const [labours, records] = await Promise.all([
      Labour.find().sort({ fullName: 1 }).lean(),
      Attendance.find({ date: new RegExp(`^${month}-`) }).lean(),
    ]);
    const summaries = new Map();
    for (const record of records) {
      const key = String(record.labour);
      const summary = summaries.get(key) || {
        presentDays: 0,
        halfDays: 0,
        absentDays: 0,
        leaveDays: 0,
        overtimeHours: 0,
      };
      if (record.status === "present") summary.presentDays += 1;
      if (record.status === "half-day") summary.halfDays += 1;
      if (record.status === "absent") summary.absentDays += 1;
      if (record.status === "leave") summary.leaveDays += 1;
      summary.overtimeHours += record.overtimeHours || 0;
      summaries.set(key, summary);
    }

    res.json(
      labours.map((labour) => {
        const summary = summaries.get(String(labour._id)) || {
          presentDays: 0,
          halfDays: 0,
          absentDays: 0,
          leaveDays: 0,
          overtimeHours: 0,
        };
        return {
          _id: labour._id,
          fullName: labour.fullName,
          role: labour.role,
          status: labour.status,
          ...summary,
          attendanceDays: summary.presentDays + summary.halfDays * 0.5,
          recordedDays:
            summary.presentDays +
            summary.halfDays +
            summary.absentDays +
            summary.leaveDays,
        };
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.put("/bulk", async (req, res, next) => {
  try {
    const { date, entries } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(entries)) {
      return res.status(400).json({ message: "A valid date and entries array are required." });
    }
    const validStatuses = new Set(["present", "absent", "half-day", "leave"]);
    const ids = entries.map((entry) => entry.labourId);
    if (
      entries.some(
        (entry) =>
          !mongoose.isValidObjectId(entry.labourId) ||
          !validStatuses.has(entry.status) ||
          !Number.isFinite(Number(entry.overtimeHours)) ||
          Number(entry.overtimeHours) < 0,
      )
    ) {
      return res.status(400).json({ message: "One or more attendance entries are invalid." });
    }
    const matchingLabours = await Labour.countDocuments({ _id: { $in: ids } });
    if (matchingLabours !== new Set(ids).size) {
      return res.status(400).json({ message: "Attendance includes an unknown labour ID." });
    }
    if (entries.length) {
      await Attendance.bulkWrite(
        entries.map((entry) => ({
          updateOne: {
            filter: { labour: entry.labourId, date },
            update: {
              $set: {
                status: entry.status,
                overtimeHours: Number(entry.overtimeHours),
              },
            },
            upsert: true,
          },
        })),
      );
    }
    res.json({ message: "Attendance saved.", count: entries.length });
  } catch (error) {
    next(error);
  }
});

export default router;
