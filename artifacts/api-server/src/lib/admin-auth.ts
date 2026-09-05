import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Request, Response } from "express";

const SESSION_COOKIE = "black_ops_admin_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const failedAttempts = new Map<string, { attempts: number; firstAttemptAt: number }>();
const revokedSessions = new Map<string, number>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

type SessionPayload = { iat: number; exp: number; nonce: string };

function hash(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function sign(value: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(value).digest();
}

function sessionId(token: string): string {
  return hash(token).toString("base64url");
}

function clearExpiredRevocations(): void {
  const now = Date.now();
  for (const [id, expiresAt] of revokedSessions) {
    if (expiresAt <= now) revokedSessions.delete(id);
  }
}

function readCookie(req: Request, name: string): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;

  for (const entry of cookies.split(";")) {
    const [key, ...value] = entry.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export function verifyPassword(password: string): boolean {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) return false;
  return timingSafeEqual(hash(password), hash(configuredPassword));
}

export function createAdminSession(): string | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const now = Date.now();
  const payload: SessionPayload = {
    iat: now,
    exp: now + SESSION_DURATION_MS,
    nonce: randomBytes(24).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret).toString("base64url")}`;
}

export function setAdminSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DURATION_MS,
    path: "/",
  });
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function hasValidAdminSession(req: Request): boolean {
  const secret = process.env.SESSION_SECRET;
  const token = readCookie(req, SESSION_COOKIE);
  if (!secret || !token) return false;
  clearExpiredRevocations();
  if (revokedSessions.has(sessionId(token))) return false;
  const [encodedPayload, encodedSignature, ...extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra.length > 0) return false;

  try {
    const providedSignature = Buffer.from(encodedSignature, "base64url");
    const expectedSignature = sign(encodedPayload, secret);
    if (
      providedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(providedSignature, expectedSignature)
    ) return false;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    return (
      Number.isSafeInteger(payload.iat) &&
      Number.isSafeInteger(payload.exp) &&
      typeof payload.nonce === "string" &&
      payload.exp > Date.now() &&
      payload.exp - payload.iat === SESSION_DURATION_MS
    );
  } catch {
    return false;
  }
}

export function revokeAdminSession(req: Request): void {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || !hasValidAdminSession(req)) return;

  try {
    const [encodedPayload] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    revokedSessions.set(sessionId(token), payload.exp);
  } catch {
    // Invalid sessions have nothing to revoke.
  }
}

export function requireAdmin(req: Request, res: Response): boolean {
  if (hasValidAdminSession(req)) return true;
  res.status(401).json({ error: "Sessão de administrador inválida ou expirada." });
  return false;
}

export function isLoginRateLimited(ip: string): boolean {
  const failure = failedAttempts.get(ip);
  if (!failure) return false;
  if (Date.now() - failure.firstAttemptAt >= LOGIN_WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return failure.attempts >= MAX_FAILED_ATTEMPTS;
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const failure = failedAttempts.get(ip);
  if (!failure || now - failure.firstAttemptAt >= LOGIN_WINDOW_MS) {
    failedAttempts.set(ip, { attempts: 1, firstAttemptAt: now });
    return;
  }
  failure.attempts += 1;
}

export function clearFailedLogins(ip: string): void {
  failedAttempts.delete(ip);
}