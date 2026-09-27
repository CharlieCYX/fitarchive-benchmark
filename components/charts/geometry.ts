/**
 * Pure chart geometry for the hand-rolled SVG kit (no chart dependency).
 * Unit-tested in tests/unit/chart-geometry.test.ts.
 */

/** Round a data max up to a "nice" axis max (1 / 2 / 2.5 / 5 / 10 × 10^n). */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const frac = value / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return nice * base;
}

/** Bar length as a 0–1 fraction of the row max (0 when all values are 0). */
export function barFraction(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0 || max <= 0) return 0;
  return Math.min(1, value / max);
}

export interface LinePoint {
  x: number;
  y: number;
}

/**
 * Map (index, value) pairs into an SVG viewport, y-axis flipped.
 * Returns nulls for non-finite values so callers can break the path.
 */
export function linePoints(
  values: Array<number | null>,
  width: number,
  height: number,
  pad: { top: number; right: number; bottom: number; left: number },
  yMax?: number,
): Array<LinePoint | null> {
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  const max = yMax ?? niceMax(Math.max(0, ...finite));
  const n = values.length;
  return values.map((v, i) => {
    if (v === null || !Number.isFinite(v)) return null;
    const x = pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = pad.top + innerH - (v / max) * innerH;
    return { x, y };
  });
}

/** Join points into an SVG path, breaking at nulls. */
export function linePath(points: Array<LinePoint | null>): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)} `;
    pen = true;
  }
  return d.trim();
}

export function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): LinePoint {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Donut slice path between two angles (degrees, 0 = 12 o'clock, clockwise).
 * Full-circle slices are drawn as two 180° arcs because SVG arcs cannot
 * close a full circle in one command.
 */
export function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const span = Math.min(360, Math.max(0, endDeg - startDeg));
  if (span === 0) return "";
  const segments = span >= 360 ? [startDeg, startDeg + 180, startDeg + 360] : [startDeg, endDeg];
  let d = "";
  for (let i = 0; i + 1 < segments.length; i += 1) {
    const a0 = segments[i];
    const a1 = segments[i + 1];
    const large = a1 - a0 > 180 ? 1 : 0;
    const o0 = polarToCartesian(cx, cy, rOuter, a0);
    const o1 = polarToCartesian(cx, cy, rOuter, a1);
    const i1 = polarToCartesian(cx, cy, rInner, a1);
    const i0 = polarToCartesian(cx, cy, rInner, a0);
    d +=
      `M${o0.x.toFixed(2)},${o0.y.toFixed(2)} ` +
      `A${rOuter},${rOuter} 0 ${large} 1 ${o1.x.toFixed(2)},${o1.y.toFixed(2)} ` +
      `L${i1.x.toFixed(2)},${i1.y.toFixed(2)} ` +
      `A${rInner},${rInner} 0 ${large} 0 ${i0.x.toFixed(2)},${i0.y.toFixed(2)} Z `;
  }
  return d.trim();
}

/** Fractions (0–1) of the total; empty/zero total → empty array. */
export function donutFractions(values: number[]): number[] {
  const total = values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  if (total <= 0) return [];
  return values.map((v) => (Number.isFinite(v) ? v / total : 0));
}
