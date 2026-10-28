import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import attendanceRoutes from "./routes/attendance.js";
import labourRoutes from "./routes/labours.js";
import salaryRoutes from "./routes/salaries.js";
import { requireSession } from "./middleware/sessionAuth.js";

const app = express();

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "degraded",
    database: databaseConnected ? "connected" : "unavailable",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/labours", requireSession, labourRoutes);
app.use("/api/attendance", requireSession, attendanceRoutes);
app.use("/api/salaries", requireSession, salaryRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  if (
    error.name === "MongooseServerSelectionError" ||
    error.name === "MongoNetworkError" ||
    error.name === "MongoNotConnectedError" ||
    error.message?.includes("buffering timed out")
  ) {
    return res.status(503).json({
      message: "Database unavailable. Check your MongoDB Atlas IP access list and connection settings.",
    });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "This record already exists." });
  }
  console.error(error);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

export default app;
