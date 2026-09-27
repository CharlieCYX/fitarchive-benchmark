import { colors } from "@/lib/design-tokens";
import { donutFractions, donutSlicePath } from "./geometry";

export interface DonutDatum {
  label: string;
  value: number;
  display: string;
}

/** Neutral-first palette; the single violet accent marks the largest slice. */
const SLICE_COLORS = [colors.accent, colors.inkSoft, colors.warm500, colors.warm300, colors.warm200];

/**
 * Donut chart (hand-rolled SVG) with a real-text legend showing each value
 * and share. Decorative only — the ChartFrame table carries the data.
 */
export function DonutChart({
  data,
  size = 140,
  centerLabel,
}: {
  data: DonutDatum[];
  size?: number;
  centerLabel?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (data.length === 0 || total <= 0) return null;
  const fractions = donutFractions(data.map((d) => d.value));
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = rOuter * 0.58;

  const cumulative: number[] = [];
  fractions.reduce((acc, f) => {
    cumulative.push(acc);
    return acc + f * 360;
  }, 0);
  const slices = data.map((d, i) => ({
    d,
    start: cumulative[i],
    end: cumulative[i] + fractions[i] * 360,
    color: SLICE_COLORS[i % SLICE_COLORS.length],
  }));

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-[140px] w-[140px] shrink-0"
        role="presentation"
        focusable="false"
      >
        {slices.map((s, i) => (
          <path
            key={i}
            d={donutSlicePath(cx, cy, rOuter, rInner, s.start, s.end)}
            fill={s.color}
          />
        ))}
        {centerLabel ? (
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize={12}
            fill={colors.ink}
            fontWeight={600}
          >
            {centerLabel}
          </text>
        ) : null}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-ink">{s.d.label}</span>
            <span className="text-xs text-warm-500">
              {s.d.display} · {((s.d.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
