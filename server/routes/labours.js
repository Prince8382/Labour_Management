import { Router } from "express";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import Labour from "../models/Labour.js";
import Payment from "../models/Payment.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const labours = await Labour.find().sort({ createdAt: -1 }).lean();
    res.json(labours);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const labour = await Labour.create(req.body);
    res.status(201).json(labour);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid labour ID." });
    }
    const labour = await Labour.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!labour) return res.status(404).json({ message: "Labour not found." });
    res.json(labour);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid labour ID." });
    }
    const labour = await Labour.findById(req.params.id);
    if (!labour) return res.status(404).json({ message: "Labour not found." });

    await Promise.all([
      Attendance.deleteMany({ labour: labour._id }),
      Payment.deleteMany({ labour: labour._id }),
    ]);
    await labour.deleteOne();
    res.json({ message: "Labour and associated records deleted." });
  } catch (error) {
    next(error);
  }
});

export default router;
