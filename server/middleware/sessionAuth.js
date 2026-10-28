import { randomBytes } from "node:crypto";

const sessions = new Map();
const cookieName = "workforce_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

function readSessionToken(req) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`));
  return cookie ? cookie.slice(cookieName.length + 1) : "";
}

export function createSession(userId) {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
  const token = randomBytes(32).toString("hex");
  sessions.set(token, { userId: String(userId), expiresAt: now + sessionDurationMs });
  return token;
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/api; Max-Age=${sessionDurationMs / 1000}${secure}`,
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

export function requireSession(req, res, next) {
  const token = readSessionToken(req);
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ message: "Please log in to continue." });
  }
  req.userId = session.userId;
  next();
}

export function removeSession(req) {
  const token = readSessionToken(req);
  if (token) sessions.delete(token);
}
