import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Admin auth — SERVER ONLY. Never import into a client component.
 *
 * Single-operator model: one passcode (ADMIN_PASSCODE) proves identity; a signed
 * HMAC cookie keeps the session. No user table, no external auth service.
 * Cookie value: "{expiresEpochSec}.{HMAC-SHA256(secret, "ethfund-admin:" + expiresEpochSec)}".
 */

export const ADMIN_COOKIE = "ethfund_admin";
const HMAC_PREFIX = "ethfund-admin:";
const SESSION_TTL_SEC = 7 * 24 * 3600;

function signingSecret(): string {
  return process.env.AUTH_SECRET || process.env.CRON_SECRET || "";
}

export function authConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE && signingSecret());
}

function hmacHex(expiresEpochSec: string): string {
  return createHmac("sha256", signingSecret())
    .update(HMAC_PREFIX + expiresEpochSec)
    .digest("hex");
}

export function signSession(ttlSec: number = SESSION_TTL_SEC): { value: string; expires: Date } {
  const expiresEpochSec = Math.floor(Date.now() / 1000) + ttlSec;
  return {
    value: `${expiresEpochSec}.${hmacHex(String(expiresEpochSec))}`,
    expires: new Date(expiresEpochSec * 1000),
  };
}

export function verifySession(cookieValue: string | undefined): boolean {
  if (!cookieValue || !signingSecret()) return false;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0) return false;
  const expiresEpochSec = cookieValue.slice(0, dot);
  const signature = cookieValue.slice(dot + 1);
  if (!/^\d{1,12}$/.test(expiresEpochSec)) return false;
  if (Number(expiresEpochSec) * 1000 < Date.now()) return false;
  const given = Buffer.from(signature, "hex");
  const expected = Buffer.from(hmacHex(expiresEpochSec), "hex");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/** Constant-time passcode check (hash both sides first so lengths never leak). */
export function checkPasscode(input: string): boolean {
  const expected = process.env.ADMIN_PASSCODE ?? "";
  if (!expected) return false;
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

function cookieFromHeader(req: Request): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_COOKIE) return rest.join("=");
  }
  return undefined;
}

/** For route handlers (plain Request). */
export function isAdminRequest(req: Request): boolean {
  return verifySession(cookieFromHeader(req));
}

/** For server components (next/headers). */
export async function isAdminFromCookies(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(ADMIN_COOKIE)?.value);
}

/** Route-handler guard: returns a 401 response to send, or null when authorized. */
export function requireAdmin(req: Request): NextResponse | null {
  if (isAdminRequest(req)) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: process.env.NODE_ENV === "production",
} as const;
