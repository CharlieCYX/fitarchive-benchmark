import { colors } from "@/lib/design-tokens";
import { linePath, linePoints, niceMax } from "./geometry";

export interface LineDatum {
  label: string;
  value: number | null;
  display: string;
}

/**
 * Minimal line chart (hand-rolled SVG). Axis labels are real text under the
 * chart; the path is decorative — the ChartFrame table is the data carrier.
 */
export function LineChart({
  data,
  height = 160,
}: {
  data: LineDatum[];
  height?: number;
}) {
  if (data.length === 0) return null;
  const width = 560;
  const pad = { top: 12, right: 12, bottom: 6, left: 40 };
  const values = data.map((d) => d.value);
  const finite = values.filter((v): v is number => v !== null);
  const max = niceMax(Math.max(0, ...finite));
  const points = linePoints(values, width, height, pad, max);
  const baseline = pad.top + (height - pad.top - pad.bottom);

  // Sparse x labels: first, middle, last.
  const labelIdx = new Set(
    [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
      (i) => i >= 0 && i < data.length,
    ),
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="presentation"
      focusable="false"
    >
      {/* y gridlines: 0, half, max */}
      {[0, 0.5, 1].map((f) => {
        const y = baseline - f * (height - pad.top - pad.bottom);
        return (
          <g key={f}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke={colors.warm200}
              strokeWidth={1}
            />
            <text
              x={pad.left - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={10}
              fill={colors.warm500}
            >
              {Math.round(max * f)}
            </text>
          </g>
        );
      })}
      <path d={linePath(points)} fill="none" stroke={colors.inkSoft} strokeWidth={2} />
      {points.map((p, i) =>
        p ? (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={colors.accent} />
        ) : null,
      )}
      {data.map((d, i) =>
        labelIdx.has(i) && points[i] ? (
          <text
            key={i}
            x={points[i]!.x}
            y={height - 0}
            textAnchor="middle"
            fontSize={10}
            fill={colors.warm500}
          >
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
