"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      const body = (await res.json()) as { error?: string };
      setError(body.error ?? "login failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: "60px auto" }}>
      <h3 style={{ margin: 0 }}>Admin access</h3>
      <p className="field-desc">
        Settings changes affect the live scanner. Enter the admin passcode to continue — the
        session lasts 7 days on this browser.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="passcode">Passcode</label>
          <input
            id="passcode"
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
            style={{
              background: "var(--panel-2)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 14,
            }}
          />
        </div>
        {error && <div className="notice error">{error}</div>}
        <button className="btn primary" type="submit" disabled={busy || !passcode}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
