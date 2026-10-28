import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { connectDatabase } from "./database.js";

const port = process.env.PORT || 5000;
let retryTimer;
let retryDelay = 5000;
let connecting = false;

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
    await connectDatabase();
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
