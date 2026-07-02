"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Thresholds } from "@/lib/config";
import type { Pair } from "@/lib/polymarket/arbitrage";
import { SettingsForm } from "./SettingsForm";
import { LivePairsPreview } from "./LivePairsPreview";
import { ChangeLog } from "./ChangeLog";

interface SettingsGetResponse {
  settings: Thresholds;
  source: "db" | "env";
  updatedAt: string | null;
  envDefaults: Thresholds;
}

export function SettingsPanel() {
  const router = useRouter();
  const [draft, setDraft] = useState<Thresholds | null>(null);
  const [envDefaults, setEnvDefaults] = useState<Thresholds | null>(null);
  const [source, setSource] = useState<"db" | "env">("env");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [changesKey, setChangesKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error(`settings load failed (${res.status})`);
        const body = (await res.json()) as SettingsGetResponse;
        if (cancelled) return;
        setDraft(body.settings);
        setEnvDefaults(body.envDefaults);
        setSource(body.source);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setErrors({});
    setNotice(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, note: note || undefined }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        settings?: Thresholds;
        errors?: Record<string, string>;
        error?: string;
      };
      if (res.ok && body.settings) {
        setDraft(body.settings);
        setSource("db");
        setNote("");
        setNotice("Saved — the scanner picks this up on its next run (≤1 minute).");
        setChangesKey((k) => k + 1);
      } else if (body.errors) {
        setErrors(body.errors);
      } else {
        setNotice(null);
        setErrors({ body: body.error ?? `save failed (${res.status})` });
      }
    } catch (err) {
      setErrors({ body: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }, [draft, note]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  if (loadError) return <div className="notice error">Could not load settings: {loadError}</div>;
  if (!draft || !envDefaults) return <div className="empty">Loading settings…</div>;

  return (
    <>
      <p className="subtitle">
        These thresholds decide what counts as a signal. They apply from the scanner’s next run —
        no redeploy needed. Every save is recorded in the change log below.
        {source === "env" && " Currently running on env defaults (no dashboard values saved yet)."}
      </p>
      <div className="settings-grid">
        <SettingsForm
          draft={draft}
          envDefaults={envDefaults}
          errors={errors}
          note={note}
          notice={notice}
          saving={saving}
          onChange={setDraft}
          onNoteChange={setNote}
          onPairToggle={(pair: Pair, on: boolean) =>
            setDraft({
              ...draft,
              pairs: on ? [...draft.pairs, pair] : draft.pairs.filter((p) => p !== pair),
            })
          }
          onSave={() => void save()}
        />
        <LivePairsPreview draft={draft} />
      </div>
      <ChangeLog refreshKey={changesKey} />
      <div style={{ marginTop: 24 }}>
        <button className="btn" onClick={() => void logout()}>
          Sign out
        </button>
      </div>
    </>
  );
}
