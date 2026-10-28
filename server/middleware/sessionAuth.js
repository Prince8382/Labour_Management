import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const cookieName = "workforce_session";
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be configured for production deployments.");
  }
  return "local-development-only-session-secret";
}

export function validateSessionConfiguration() {
  if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
    const error = new Error("SESSION_SECRET is missing. Set it in the Render environment and redeploy.");
    error.status = 503;
    error.code = "SESSION_SECRET_MISSING";
    throw error;
  }
}

function sign(payload) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function readSessionToken(req) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${cookieName}=`));
  return cookie ? cookie.slice(cookieName.length + 1) : "";
}

export function createSession(userId) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: String(userId),
      expiresAt: Date.now() + sessionDurationMs,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSession(token) {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof session.userId !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function cookieOptions(req) {
  const isSecure =
    process.env.NODE_ENV === "production" ||
    req?.headers["x-forwarded-proto"]?.split(",")[0] === "https";
  return {
    secure: isSecure ? "; Secure" : "",
    sameSite: isSecure ? "None" : "Lax",
  };
}

export function setSessionCookie(res, token, req) {
  const { secure, sameSite } = cookieOptions(req);
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=${token}; HttpOnly; SameSite=${sameSite}; Path=/api; Max-Age=${sessionDurationMs / 1000}${secure}`,
  );
}

export function clearSessionCookie(res, req) {
  const { secure, sameSite } = cookieOptions(req);
  res.setHeader(
    "Set-Cookie",
    `${cookieName}=; HttpOnly; SameSite=${sameSite}; Path=/api; Max-Age=0${secure}`,
  );
}

export function requireSession(req, res, next) {
  const token = readSessionToken(req);
  const session = readSession(token);
  if (!session) {
    return res.status(401).json({ message: "Please log in to continue." });
  }
  req.userId = session.userId;
  next();
}
