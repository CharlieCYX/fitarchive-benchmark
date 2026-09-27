import { barFraction } from "./geometry";

export interface BarDatum {
  label: string;
  value: number;
  /** Formatted value shown at bar end (from a lib/metrics formatter). */
  display: string;
  /** Per-bar sample count, shown beside the number (§12.3). */
  sampleSize?: number | null;
}

/**
 * Horizontal bar chart, hand-rolled SVG-free variant: labelled rows whose
 * fill width is proportional to the value. Labels and values are real text
 * (visible without hover); the fill is decorative (aria-hidden via ChartFrame).
 * Neutral ink fill; semantic colour only when the caller passes `tone`.
 */
export function BarChart({
  data,
  tone = "neutral",
}: {
  data: BarDatum[];
  tone?: "neutral" | "accent";
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 0);
  const fill = tone === "accent" ? "bg-accent/70" : "bg-warm-700/70";
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-ink">{d.label}</span>
            <span className="shrink-0 text-xs text-warm-500">
              <span className="font-medium text-ink">{d.display}</span>
              {d.sampleSize !== undefined && d.sampleSize !== null
                ? ` · n = ${d.sampleSize}`
                : null}
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-sm bg-warm-100">
            <div
              className={`h-2 rounded-sm ${fill}`}
              style={{ width: `${(barFraction(d.value, max) * 100).toFixed(2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
