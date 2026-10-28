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
