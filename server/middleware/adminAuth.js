import { randomBytes } from "node:crypto";

const sessions = new Map();
const sessionDurationMs = 8 * 60 * 60 * 1000;
const sessionCookieName = "admin_session";

function getSessionToken(req) {
  const cookies = req.headers.cookie?.split(";") || [];
  const sessionCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${sessionCookieName}=`),
  );
  return sessionCookie ? sessionCookie.trim().slice(sessionCookieName.length + 1) : "";
}

export function createAdminSession() {
  const now = Date.now();
  for (const [session, expiresAt] of sessions) {
    if (expiresAt <= now) sessions.delete(session);
  }
  const token = randomBytes(32).toString("hex");
  sessions.set(token, now + sessionDurationMs);
  return token;
}

export function setAdminSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${sessionDurationMs / 1000}${secure}`,
  );
}

export function clearAdminSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

export function revokeAdminSession(req) {
  const token = getSessionToken(req);
  if (token) sessions.delete(token);
}

export function requireAdmin(req, res, next) {
  const token = getSessionToken(req);
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ message: "Admin login required." });
  }
  next();
}
