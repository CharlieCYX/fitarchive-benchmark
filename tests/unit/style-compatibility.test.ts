import { describe, expect, it } from "vitest";

import { assessCompatibility, climateWarnings } from "@/features/style-engine/compatibility";
import type { GarmentProfile } from "@/features/style-engine/types";

function garment(partial: Partial<GarmentProfile> & { id: string; label: string }): GarmentProfile {
  return {
    source: "manual",
    category: null,
    silhouette: [],
    material: [],
    palette: [],
    energy: [],
    era: [],
    priceSgd: null,
    availability: null,
    ...partial,
  };
}

describe("Can This Work? (§8.4)", () => {
  it("cropped linen shirt + wide cotton trouser, both neutral/clean → compatible", () => {
    const result = assessCompatibility(
      garment({
        id: "a",
        label: "Cropped linen shirt",
        category: "shirt",
        silhouette: ["cropped"],
        material: ["linen"],
        palette: ["neutral"],
        energy: ["clean"],
        era: ["contemporary"],
      }),
      garment({
        id: "b",
        label: "Wide cotton trouser",
        category: "trouser",
        silhouette: ["wide"],
        material: ["cotton"],
        palette: ["neutral"],
        energy: ["clean"],
        era: ["contemporary"],
      }),
    );
    expect(result.verdict).toBe("compatible");
    expect(result.assessments).toHaveLength(7); // all §8.4 dimensions
  });

  it("era clash + loud palettes → tension with repair moves, never costume-silent", () => {
    const result = assessCompatibility(
      garment({
        id: "a",
        label: "70s disco shirt",
        category: "shirt",
        silhouette: ["fitted"],
        material: ["polyester"],
        palette: ["jewel"],
        energy: ["playful"],
        era: ["70s"],
      }),
      garment({
        id: "b",
        label: "Techwear trouser",
        category: "trouser",
        silhouette: ["tapered"],
        material: ["nylon"],
        palette: ["metallic"],
        energy: ["futuristic"],
        era: ["contemporary"],
      }),
    );
    expect(result.verdict).not.toBe("compatible");
    expect(result.repairMoves.length).toBeGreaterThan(0);
    const era = result.assessments.find((a) => a.dimension === "era");
    expect(era?.score).toBeLessThan(0.6);
  });

  it("wool coat + mesh top in Singapore: big material gap → tension + swap repair", () => {
    const result = assessCompatibility(
      garment({ id: "a", label: "Wool coat", category: "outerwear", material: ["wool"], silhouette: ["structured"] }),
      garment({ id: "b", label: "Mesh top", category: "top", material: ["mesh"], silhouette: ["fitted"] }),
    );
    const material = result.assessments.find((a) => a.dimension === "material");
    expect(material?.score).toBeLessThan(1);
    expect(result.repairMoves.join(" ")).toMatch(/linen|cotton|swap/i);
  });

  it("oversized-on-oversized is called out as a proportion risk", () => {
    const result = assessCompatibility(
      garment({ id: "a", label: "Oversized hoodie", category: "top", silhouette: ["oversized"] }),
      garment({ id: "b", label: "Wide trouser", category: "trouser", silhouette: ["wide"] }),
    );
    const proportion = result.assessments.find((a) => a.dimension === "proportion");
    expect(proportion?.score).toBeLessThan(0.7);
    expect(result.repairMoves.join(" ")).toMatch(/tuck|crop|longline/i);
  });

  it("verdicts are deterministic", () => {
    const a = garment({ id: "a", label: "A", category: "shirt", silhouette: ["cropped"], palette: ["neutral"], energy: ["clean"], era: ["90s"], material: ["cotton"] });
    const b = garment({ id: "b", label: "B", category: "denim", silhouette: ["straight"], palette: ["neutral"], energy: ["rugged"], era: ["90s"], material: ["denim"] });
    expect(assessCompatibility(a, b)).toEqual(assessCompatibility(a, b));
  });
});

describe("climateWarnings (§8.4 Singapore pre-check)", () => {
  it("flags wool in hot-humid with the piece name", () => {
    const warnings = climateWarnings(
      [garment({ id: "a", label: "Wool blazer", material: ["wool"] })],
      "hot-humid",
    );
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("Wool blazer");
  });

  it("stays quiet for linen in hot-humid", () => {
    expect(
      climateWarnings([garment({ id: "a", label: "Linen shirt", material: ["linen"] })], "hot-humid"),
    ).toHaveLength(0);
  });
});
