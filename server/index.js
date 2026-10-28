import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import attendanceRoutes from "./routes/attendance.js";
import labourRoutes from "./routes/labours.js";
import salaryRoutes from "./routes/salaries.js";
import { requireSession } from "./middleware/sessionAuth.js";

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;
let retryTimer;
let retryDelay = 5000;
let connecting = false;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? "ok" : "degraded",
    database: databaseConnected ? "connected" : "unavailable",
  });
});
app.use("/api/auth", authRoutes);
app.use("/api", requireSession);
app.use("/api/labours", labourRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/salaries", salaryRoutes);

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
    return res.status(409).json({ message: "Attendance for this labour and date already exists." });
  }
  console.error(error);
  res.status(500).json({ message: "An unexpected server error occurred." });
});

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Copy .env.example to .env and configure MongoDB.");
}

mongoose.set("bufferTimeoutMS", 5000);

function scheduleMongoRetry() {
  if (retryTimer || connecting) return;
  const delay = retryDelay;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    connectToMongo();
  }, delay);
  retryDelay = Math.min(delay * 2, 30000);
  console.log(`Retrying MongoDB connection in ${Math.round(delay / 1000)} seconds.`);
}

async function connectToMongo() {
  if (connecting || mongoose.connection.readyState === 1) return;
  connecting = true;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    retryDelay = 5000;
    console.log("MongoDB connected.");
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    console.error("For Atlas, add this computer's current public IP to Network Access > IP Access List.");
  } finally {
    connecting = false;
    if (mongoose.connection.readyState !== 1) scheduleMongoRetry();
  }
}

mongoose.connection.on("disconnected", scheduleMongoRetry);
mongoose.connection.on("error", (error) => {
  console.error(`MongoDB connection error: ${error.message}`);
});

app.listen(port, () => {
  console.log(`Amit Yadav Labour Manager API running at http://localhost:${port}`);
  connectToMongo();
});
