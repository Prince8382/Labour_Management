import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import User from "../models/User.js";
import {
  clearSessionCookie,
  createSession,
  requireSession,
  setSessionCookie,
  validateSessionConfiguration,
} from "../middleware/sessionAuth.js";

const router = Router();
const scrypt = promisify(scryptCallback);

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64)).toString("hex");
}

function validUsername(username) {
  return typeof username === "string" && /^[A-Za-z0-9._-]{3,30}$/.test(username.trim());
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

router.post("/signup", async (req, res, next) => {
  try {
    validateSessionConfiguration();
    const { username, password } = req.body || {};
    if (!validUsername(username) || !validPassword(password)) {
      return res.status(400).json({
        message: "Username must be 3–30 characters; password must be 8–128 characters.",
      });
    }

    const passwordSalt = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, passwordSalt);
    const user = await User.create({ username: username.trim(), passwordHash, passwordSalt });
    setSessionCookie(res, createSession(user._id), req);
    res.status(201).json({ username: user.username });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "That username is already taken." });
    }
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    validateSessionConfiguration();
    const { username, password } = req.body || {};
    if (typeof username !== "string" || typeof password !== "string" || password.length > 128) {
      return res.status(400).json({ message: "Enter your username and password." });
    }
    const user = await User.findOne({ username: username.trim() });
    let passwordMatches = false;
    if (user) {
      const actual = Buffer.from(await hashPassword(password, user.passwordSalt), "hex");
      const expected = Buffer.from(user.passwordHash, "hex");
      passwordMatches = actual.length === expected.length && timingSafeEqual(actual, expected);
    }
    if (!user || !passwordMatches) {
      return res.status(401).json({ message: "Username or password is incorrect." });
    }

    setSessionCookie(res, createSession(user._id), req);
    res.json({ username: user.username });
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireSession, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("username").lean();
    if (!user) return res.status(401).json({ message: "Please log in to continue." });
    res.json({ username: user.username });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireSession, (req, res) => {
  clearSessionCookie(res, req);
  res.json({ message: "Logged out." });
});

export default router;
