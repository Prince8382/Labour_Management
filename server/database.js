import mongoose from "mongoose";

let connectionPromise;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required. Configure it in the deployment environment.");
  }
  if (!connectionPromise) {
    mongoose.set("bufferTimeoutMS", 5000);
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
      .catch((error) => {
        connectionPromise = undefined;
        throw error;
      });
  }
  await connectionPromise;
}
