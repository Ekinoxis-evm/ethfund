import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  authConfigured,
  checkPasscode,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cheap brute-force damper — no rate-limit infra on stateless lambdas.
const FAILURE_DELAY_MS = 400;

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "admin auth not configured" }, { status: 503 });
  }
  let passcode = "";
  try {
    const body = (await req.json()) as { passcode?: unknown };
    if (typeof body.passcode === "string") passcode = body.passcode;
  } catch {
    /* treated as invalid below */
  }
  if (!passcode || !checkPasscode(passcode)) {
    await new Promise((resolve) => setTimeout(resolve, FAILURE_DELAY_MS));
    return NextResponse.json({ error: "invalid passcode" }, { status: 401 });
  }
  const session = signSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, session.value, {
    ...sessionCookieOptions,
    expires: session.expires,
  });
  return res;
}
