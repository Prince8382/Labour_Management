import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import Admin from "../models/Admin.js";
import {
  clearAdminSessionCookie,
  createAdminSession,
  requireAdmin,
  revokeAdminSession,
  setAdminSessionCookie,
} from "../middleware/adminAuth.js";

const router = Router();
const loginAttempts = new Map();
const maxAttempts = 5;
const lockDurationMs = 15 * 60 * 1000;
const scrypt = promisify(scryptCallback);

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64)).toString("hex");
}

router.get("/status", async (_req, res, next) => {
  try {
    res.json({ setupRequired: !(await Admin.exists({ _id: "primary" })) });
  } catch (error) {
    next(error);
  }
});

router.post("/setup", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (
      typeof username !== "string" ||
      !/^[A-Za-z0-9._-]{3,40}$/.test(username.trim()) ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message:
          "Use a 3–40 character username (letters, numbers, dot, underscore or hyphen) and a 12–128 character password.",
      });
    }

    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, passwordSalt);
    const admin = await Admin.create({
      _id: "primary",
      username: username.trim(),
      passwordHash,
      passwordSalt,
    });

    loginAttempts.delete(req.ip);
    const token = createAdminSession();
    setAdminSessionCookie(res, token);
    res.status(201).json({ username: admin.username });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Admin setup is already complete. Please sign in." });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const clientIp = req.ip;
    const now = Date.now();
    const attempt = loginAttempts.get(clientIp);

    if (attempt?.lockedUntil > now) {
      return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
    }
    const isExpiredLock = attempt?.lockedUntil && attempt.lockedUntil <= now;
    if (isExpiredLock) loginAttempts.delete(clientIp);
    const previousFailedAttempts = isExpiredLock ? 0 : attempt?.failedAttempts || 0;

    const { username, password } = req.body || {};
    const admin = await Admin.findById("primary");
    let validPassword = false;
    if (admin && typeof password === "string" && password.length <= 128) {
      const candidateHash = Buffer.from(await hashPassword(password, admin.passwordSalt), "hex");
      const expectedHash = Buffer.from(admin.passwordHash, "hex");
      validPassword =
        candidateHash.length === expectedHash.length &&
        timingSafeEqual(candidateHash, expectedHash);
    }
    if (typeof username !== "string" || !admin || username.trim() !== admin.username || !validPassword) {
      const failedAttempts = previousFailedAttempts + 1;
      loginAttempts.set(clientIp, {
        failedAttempts,
        lockedUntil: failedAttempts >= maxAttempts ? now + lockDurationMs : 0,
      });
      return res.status(401).json({ message: "Username or password is incorrect." });
    }

    loginAttempts.delete(clientIp);
    const token = createAdminSession();
    setAdminSessionCookie(res, token);
    res.json({ username: admin.username });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAdmin, async (_req, res, next) => {
  try {
    const admin = await Admin.findById("primary").select("username").lean();
    if (!admin) return res.status(401).json({ message: "Admin account is not configured." });
    res.json({ username: admin.username });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAdmin, (req, res) => {
  revokeAdminSession(req);
  clearAdminSessionCookie(res);
  res.json({ message: "Logged out." });
});

export default router;
