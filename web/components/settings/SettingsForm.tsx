"use client";

import type { Thresholds } from "@/lib/config";
import { ALL_PAIRS } from "@/lib/pairs";
import type { Pair } from "@/lib/polymarket/arbitrage";
import { PAIR_META, SETTINGS_META, type SettingKey } from "@/lib/settingsMeta";
import { pct, usd } from "@/lib/format";

/** Fraction-unit fields ("%" and "¢") are edited as percentage points; "$" fields as raw USD. */
function toDisplay(unit: string, v: number): number {
  return unit === "$" ? v : Math.round(v * 1000 * 100) / 1000;
}
function fromDisplay(unit: string, v: number): number {
  return unit === "$" ? v : v / 100;
}
function hint(unit: string, v: number): string {
  return unit === "$" ? usd(v) : pct(v);
}

export function SettingsForm({
  draft,
  envDefaults,
  errors,
  note,
  notice,
  saving,
  onChange,
  onNoteChange,
  onPairToggle,
  onSave,
}: {
  draft: Thresholds;
  envDefaults: Thresholds;
  errors: Record<string, string>;
  note: string;
  notice: string | null;
  saving: boolean;
  onChange: (t: Thresholds) => void;
  onNoteChange: (s: string) => void;
  onPairToggle: (pair: Pair, on: boolean) => void;
  onSave: () => void;
}) {
  return (
    <div className="card">
      <h3 style={{ margin: 0 }}>Thresholds</h3>
      {SETTINGS_META.map((meta) => {
        const key: SettingKey = meta.key;
        return (
          <div className="field" key={key}>
            <label htmlFor={key}>
              {meta.label} {meta.unit === "$" ? "($)" : "(%)"}
            </label>
            <input
              id={key}
              type="number"
              min={toDisplay(meta.unit, meta.min)}
              max={toDisplay(meta.unit, meta.max)}
              step={meta.unit === "$" ? meta.step : meta.step * 100}
              value={toDisplay(meta.unit, draft[key])}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) onChange({ ...draft, [key]: fromDisplay(meta.unit, n) });
              }}
            />
            <div className="field-desc">
              {meta.description} {meta.effect}{" "}
              <em>Env default: {hint(meta.unit, envDefaults[key])}.</em>
            </div>
            {errors[key] && <div className="field-error">{errors[key]}</div>}
          </div>
        );
      })}

      <div className="field">
        <label>Pairs to compare</label>
        <div className="field-desc" style={{ marginBottom: 6 }}>
          Which duration combinations the scanner evaluates. All pairs only compare markets that
          expire at the exact same minute.
        </div>
        {ALL_PAIRS.map((pair) => (
          <div className="checkrow" key={pair}>
            <input
              id={`pair-${pair}`}
              type="checkbox"
              checked={draft.pairs.includes(pair)}
              onChange={(e) => onPairToggle(pair, e.target.checked)}
            />
            <label htmlFor={`pair-${pair}`} style={{ textTransform: "none", fontWeight: 400 }}>
              <span className="pairname">{pair}</span>{" "}
              <span className="field-desc">{PAIR_META[pair]}</span>
            </label>
          </div>
        ))}
        {errors.pairs && <div className="field-error">{errors.pairs}</div>}
      </div>

      <div className="field">
        <label htmlFor="note">Why this change? (recorded in the change log)</label>
        <textarea
          id="note"
          value={note}
          placeholder="e.g. lowering volume floor — 5M/15M markets never reach $20k"
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>

      {errors.body && <div className="notice error">{errors.body}</div>}
      {notice && <div className="notice">{notice}</div>}

      <div>
        <button className="btn primary" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
