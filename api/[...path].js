import app from "../server/app.js";
import { connectDatabase } from "../server/database.js";

export default async function handler(req, res) {
  if (req.url?.startsWith("/api/health")) {
    return app(req, res);
  }

  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error(`Database unavailable for API request: ${error.message}`);
    return res.status(503).json({
      message: "Database unavailable. Check MongoDB Atlas Network Access and MONGODB_URI.",
    });
  }
}
