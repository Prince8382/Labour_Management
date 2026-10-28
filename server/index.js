import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import attendanceRoutes from "./routes/attendance.js";
import labourRoutes from "./routes/labours.js";
import salaryRoutes from "./routes/salaries.js";
import { requireAdmin } from "./middleware/adminAuth.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api", requireAdmin);
app.use("/api/labours", labourRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/salaries", salaryRoutes);

app.use((error, _req, res, _next) => {
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: error.message });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "Attendance for this labour and date already exists." });
  }
  console.error(error);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.");
}
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(port, () => console.log(`Amit Yadav Labour Manager API running at http://localhost:${port}`));
  })
  .catch((error) => {
    console.error("Could not connect to MongoDB:", error);
    process.exitCode = 1;
  });
