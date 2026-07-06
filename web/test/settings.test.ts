import { test } from "node:test";
import assert from "node:assert/strict";

import { signSession, verifySession, checkPasscode } from "../lib/auth";
import { validateSettingsInput, loadThresholds } from "../lib/settings";

// auth.ts reads env lazily (inside each function), so setting these after import is safe.
process.env.AUTH_SECRET = "test-secret";
process.env.ADMIN_PASSCODE = "correct horse battery staple";

test("session round-trip verifies", () => {
  const { value } = signSession();
  assert.equal(verifySession(value), true);
});

test("tampered session is rejected", () => {
  const { value } = signSession();
  const dot = value.indexOf(".");
  const expires = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
  assert.equal(verifySession(`${expires}.${flipped}`), false);
  // extending expiry without re-signing must fail too
  assert.equal(verifySession(`${Number(expires) + 9999}.${sig}`), false);
});

test("expired session is rejected", () => {
  const { value } = signSession(-10);
  assert.equal(verifySession(value), false);
});

test("garbage session values are rejected", () => {
  assert.equal(verifySession(undefined), false);
  assert.equal(verifySession(""), false);
  assert.equal(verifySession("not-a-session"), false);
  assert.equal(verifySession("123456."), false);
  assert.equal(verifySession(".abcdef"), false);
});

test("passcode check", () => {
  assert.equal(checkPasscode("correct horse battery staple"), true);
  assert.equal(checkPasscode("wrong"), false);
  assert.equal(checkPasscode(""), false);
});

test("validateSettingsInput accepts a valid payload", () => {
  const result = validateSettingsInput({
    minSpread: 0.04,
    minLiquidity: 1500,
    minVolume: 500,
    maxBidAsk: 0.03,
    pairs: ["4H-vs-1H", "15M-vs-5M"],
    note: "  tuning for micro-markets  ",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.minSpread, 0.04);
    assert.deepEqual(result.value.pairs, ["4H-vs-1H", "15M-vs-5M"]);
    assert.equal(result.value.note, "tuning for micro-markets");
  }
});

test("validateSettingsInput rejects bad values with per-field errors", () => {
  const result = validateSettingsInput({
    minSpread: 1.5, // > 1
    minLiquidity: "abc",
    minVolume: -5,
    maxBidAsk: 0.02,
    pairs: ["4H-vs-1H", "bogus"],
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.errors.minSpread ?? "", /between/);
    assert.match(result.errors.minLiquidity ?? "", /number/);
    assert.match(result.errors.minVolume ?? "", /between/);
    assert.equal(result.errors.maxBidAsk, undefined);
    assert.match(result.errors.pairs ?? "", /bogus/);
  }
});

test("validateSettingsInput rejects empty pairs and non-objects", () => {
  const empty = validateSettingsInput({
    minSpread: 0.05,
    minLiquidity: 5000,
    minVolume: 20000,
    maxBidAsk: 0.02,
    pairs: [],
  });
  assert.equal(empty.ok, false);
  assert.equal(validateSettingsInput(null).ok, false);
  assert.equal(validateSettingsInput("nope").ok, false);
});

test("loadThresholds falls back to env when the DB is not configured", async () => {
  // Test env has no SUPABASE_URL / SERVICE_ROLE_KEY → dbConfigured() is false.
  const t = await loadThresholds();
  assert.equal(t.source, "env");
  assert.equal(t.updatedAt, null);
  assert.equal(typeof t.minSpread, "number");
  assert.ok(t.pairs.length >= 1);
});
