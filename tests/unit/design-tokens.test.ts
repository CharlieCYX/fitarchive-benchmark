import { describe, expect, it } from "vitest";
import { colors, radii, spacingScale } from "@/lib/design-tokens";

describe("design tokens (Build Bible §14.2)", () => {
  it("uses exactly one violet accent: #5B3FD3", () => {
    expect(colors.accent).toBe("#5b3fd3");
  });

  it("keeps the 4/8/12/16/24/32/48/64 spacing rhythm", () => {
    expect([...spacingScale]).toEqual([4, 8, 12, 16, 24, 32, 48, 64]);
    for (const step of spacingScale) {
      expect(step % 4).toBe(0);
    }
  });

  it("keeps radii within the 6–10px range", () => {
    for (const radius of Object.values(radii)) {
      expect(radius).toBeGreaterThanOrEqual(6);
      expect(radius).toBeLessThanOrEqual(10);
    }
  });

  it("base palette is near-black / warm-gray / white (no saturated second hue)", () => {
    expect(colors.ink).toBe("#1a1815");
    expect(colors.paper).toBe("#faf8f5");
    expect(colors.white).toBe("#ffffff");
  });
});
