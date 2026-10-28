import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import attendanceRoutes from "./routes/attendance.js";
import labourRoutes from "./routes/labours.js";
import salaryRoutes from "./routes/salaries.js";
import { requireSession } from "./middleware/sessionAuth.js";

const app = express();
const allowedOrigins = new Set([
  "http://localhost:5173",
  "https://labour-management-lemon.vercel.app",
  ...(process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

function isAllowedOrigin(origin) {
  return (
    allowedOrigins.has(origin) ||
    /^https:\/\/labour-management-[a-z0-9-]+-prince-chaudharys-projects-9fb8231a\.vercel\.app$/.test(
      origin,
    )
  );
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    const error = new Error("This website origin is not allowed. Add it to Render's CLIENT_ORIGINS and redeploy.");
    error.status = 403;
    callback(error);
  },
  credentials: true,
};

app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const sessionConfigured =
    process.env.NODE_ENV !== "production" || Boolean(process.env.SESSION_SECRET);
  const corsConfigured =
    process.env.NODE_ENV !== "production" ||
    isAllowedOrigin("https://labour-management-lemon.vercel.app");
  const ready = databaseConnected && sessionConfigured && corsConfigured;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ok" : "degraded",
    database: databaseConnected ? "connected" : "unavailable",
    configuration: {
      sessionSecret: sessionConfigured ? "configured" : "missing",
      clientOrigins: corsConfigured ? "configured" : "missing",
    },
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
  if (error.status === 403) {
    return res.status(403).json({ message: error.message });
  }
  if (error.code === "SESSION_SECRET_MISSING") {
    return res.status(error.status).json({ message: error.message });
  }
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
