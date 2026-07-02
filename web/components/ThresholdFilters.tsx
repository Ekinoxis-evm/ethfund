"use client";

export interface Filters {
  minSpread: number;
  pair: string;
  hideExpired: boolean;
}

export function ThresholdFilters({
  filters,
  onChange,
  pairs,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  pairs: string[];
}) {
  return (
    <div className="controls">
      <div className="control">
        <label>Min spread %</label>
        <input
          type="number"
          step="0.5"
          min="0"
          value={(filters.minSpread * 100).toString()}
          onChange={(e) => onChange({ ...filters, minSpread: Number(e.target.value) / 100 })}
        />
      </div>
      <div className="control">
        <label>Pair</label>
        <select value={filters.pair} onChange={(e) => onChange({ ...filters, pair: e.target.value })}>
          <option value="">all</option>
          {pairs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="control">
        <label>Hide expired</label>
        <select
          value={filters.hideExpired ? "yes" : "no"}
          onChange={(e) => onChange({ ...filters, hideExpired: e.target.value === "yes" })}
        >
          <option value="yes">yes</option>
          <option value="no">no</option>
        </select>
      </div>
    </div>
  );
}
