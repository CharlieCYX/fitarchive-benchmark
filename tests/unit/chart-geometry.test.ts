import { describe, expect, it } from "vitest";

import {
  barFraction,
  donutFractions,
  donutSlicePath,
  linePath,
  linePoints,
  niceMax,
  polarToCartesian,
} from "@/components/charts/geometry";

describe("chart geometry (components/charts)", () => {
  it("niceMax rounds up to nice steps", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(0.4)).toBe(0.5);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(529)).toBe(1000);
  });

  it("barFraction clamps to 0–1 and never divides by zero", () => {
    expect(barFraction(5, 10)).toBe(0.5);
    expect(barFraction(20, 10)).toBe(1);
    expect(barFraction(0, 10)).toBe(0);
    expect(barFraction(5, 0)).toBe(0);
  });

  it("linePoints maps values into the viewport with y flipped", () => {
    const pts = linePoints([0, 50, 100], 100, 100, { top: 0, right: 0, bottom: 0, left: 0 }, 100);
    expect(pts[0]).toEqual({ x: 0, y: 100 });
    expect(pts[1]).toEqual({ x: 50, y: 50 });
    expect(pts[2]).toEqual({ x: 100, y: 0 });
  });

  it("linePoints tolerates nulls and breaks the path", () => {
    const pts = linePoints([10, null, 20], 100, 100, { top: 0, right: 0, bottom: 0, left: 0 }, 100);
    expect(pts[1]).toBeNull();
    const d = linePath(pts);
    expect(d.startsWith("M")).toBe(true);
    expect(d.split("M").length - 1).toBe(2); // two segments
  });

  it("polarToCartesian: 0° is 12 o'clock", () => {
    const p = polarToCartesian(50, 50, 40, 0);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(10);
  });

  it("donutFractions sums to 1 and handles empty totals", () => {
    expect(donutFractions([1, 1, 2])).toEqual([0.25, 0.25, 0.5]);
    expect(donutFractions([0, 0])).toEqual([]);
  });

  it("donutSlicePath emits arcs; full circle splits into two arcs", () => {
    const quarter = donutSlicePath(50, 50, 40, 20, 0, 90);
    expect(quarter).toContain("A40,40");
    expect(quarter.match(/A40,40/g)).toHaveLength(1);
    const full = donutSlicePath(50, 50, 40, 20, 0, 360);
    expect(full.match(/A40,40/g)).toHaveLength(2);
    expect(donutSlicePath(50, 50, 40, 20, 0, 0)).toBe("");
  });
});
