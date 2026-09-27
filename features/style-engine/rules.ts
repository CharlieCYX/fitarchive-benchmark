import type { Climate } from "./types";

/**
 * Deterministic style rules (§8.3–8.5). Pure lookup tables + small scoring
 * functions — this is the constraint logic the AI layer may narrate but
 * never override (§13.4). Every table is unit-tested.
 */

/* ------------------------------- materials ------------------------------- */

/** Relative warmth 1 (coolest) – 5 (warmest). */
export const MATERIAL_WARMTH: Record<string, number> = {
  linen: 1,
  silk: 1,
  mesh: 1,
  cotton: 2,
  "rayon-viscose": 2,
  nylon: 2,
  denim: 3,
  polyester: 3,
  "mixed-unknown": 3,
  knit: 4,
  leather: 4,
  wool: 5,
};

/** Breathable substitutes used in the Singapore translation (§8.5). */
export const MATERIAL_SUBSTITUTES: Record<string, string[]> = {
  wool: ["linen", "cotton"],
  leather: ["cotton", "nylon"],
  knit: ["mesh", "cotton"],
  denim: ["cotton", "linen"],
  polyester: ["cotton", "rayon-viscose"],
  silk: ["linen", "cotton"],
};

export function materialWarmth(material: string): number {
  return MATERIAL_WARMTH[material] ?? 3; // unknown materials: assume mid-weight
}

export function garmentWarmth(materials: string[]): number {
  if (!materials.length) return 3;
  return Math.max(...materials.map(materialWarmth));
}

/**
 * Climate compatibility (Singapore-first). hot-humid rejects heavy materials
 * (warmth ≥ 4) outright and cautions on mid-weight (3). Returns null when
 * the garment is fine for the climate.
 */
export function climateIssue(
  materials: string[],
  climate: Climate,
): { severity: "reject" | "caution"; note: string } | null {
  const warmth = garmentWarmth(materials);
  const heavy = materials.filter((m) => materialWarmth(m) >= 4);
  switch (climate) {
    case "hot-humid":
      if (warmth >= 4) {
        return {
          severity: "reject",
          note: `${heavy.join(", ") || "this fabric"} traps heat — wrong for 32°C/80% humidity days.`,
        };
      }
      if (warmth === 3) {
        return {
          severity: "caution",
          note: "Mid-weight fabric — fine indoors, warm on outdoor commutes.",
        };
      }
      return null;
    case "indoor-aircon":
      if (warmth >= 5) {
        return {
          severity: "caution",
          note: "Heavy even for aircon — keep it to short outdoor exposure.",
        };
      }
      return null;
    case "mild":
    case "cold":
      return null;
  }
}

/* ------------------------------- formality ------------------------------- */

const ENERGY_FORMALITY: Record<string, number> = {
  formal: 5,
  sharp: 4,
  clean: 3,
  soft: 3,
  romantic: 3,
  archival: 3,
  futuristic: 2,
  utilitarian: 2,
  rugged: 2,
  sporty: 1,
  playful: 1,
};

const CATEGORY_FORMALITY: Record<string, number> = {
  dress: 4,
  shirt: 4,
  trouser: 3,
  skirt: 3,
  outerwear: 3,
  knitwear: 2,
  top: 2,
  denim: 2,
  footwear: 2,
  bag: 2,
  accessory: 2,
  other: 2,
};

/** Formality 1–5: the dressier of the energy signal and category baseline. */
export function formalityScore(garment: {
  category: string | null;
  energy: string[];
}): number {
  const energyScores = garment.energy.map((e) => ENERGY_FORMALITY[e] ?? 3);
  const categoryScore = CATEGORY_FORMALITY[garment.category ?? "other"] ?? 2;
  return Math.max(categoryScore, ...energyScores, 1);
}

/* -------------------------------- palette -------------------------------- */

const NEUTRAL_PALETTES = new Set([
  "neutral",
  "monochrome",
  "low-contrast",
  "earth",
  "pastel",
]);

/**
 * Palette-role harmony (0–1). Neutrals harmonize with everything; two loud
 * palettes clash unless they match exactly.
 */
export function paletteHarmony(a: string, b: string): number {
  if (a === b) return 1;
  if (NEUTRAL_PALETTES.has(a) || NEUTRAL_PALETTES.has(b)) return 0.9;
  // high-contrast / accent-color / jewel / metallic × 2
  if (
    (a === "metallic" && b === "jewel") ||
    (a === "jewel" && b === "metallic")
  ) {
    return 0.3;
  }
  return 0.4;
}

/* ------------------------------- silhouette ------------------------------ */

const WIDE_BOTTOMS = new Set(["wide", "flared", "relaxed", "straight"]);
const SLIM_BOTTOMS = new Set(["fitted", "tapered"]);
const BIG_TOPS = new Set(["oversized", "boxy", "draped"]);

/**
 * Proportion pairing (top silhouette × bottom silhouette, §8.4). Returns a
 * score plus the reasoning so the UI can explain, not just assert.
 */
export function silhouettePairing(
  top: string,
  bottom: string,
): { score: number; note: string } {
  if (top === bottom && (BIG_TOPS.has(top) || WIDE_BOTTOMS.has(top))) {
    return {
      score: 0.45,
      note: `${top} over ${top} doubles the volume — the line swallows the frame unless one piece is cropped.`,
    };
  }
  if ((top === "cropped" || top === "fitted") && WIDE_BOTTOMS.has(bottom)) {
    return {
      score: 1,
      note: `Short/fitted top over a ${bottom} bottom resets the waistline — a balanced short-over-long proportion.`,
    };
  }
  if (BIG_TOPS.has(top) && SLIM_BOTTOMS.has(bottom)) {
    return {
      score: 1,
      note: `Volume up top over a ${bottom} leg reads deliberate — top-heavy in a good way.`,
    };
  }
  if (BIG_TOPS.has(top) && WIDE_BOTTOMS.has(bottom)) {
    return {
      score: 0.55,
      note: "Volume on volume works only with a cropped or tucked break; untucked it reads shapeless.",
    };
  }
  if (top === "structured" && bottom === "draped") {
    return { score: 0.8, note: "Structure over drape is a classic tension — keep the palette quiet." };
  }
  return { score: 0.7, note: `${top} with ${bottom} is a workable, low-risk pairing.` };
}

/* ---------------------------------- era ---------------------------------- */

const ERA_ORDER = ["70s", "80s", "90s", "2000s-y2k", "contemporary"];

/**
 * Era affinity (0–1). "vintage-uncertain" is honest uncertainty, not a
 * verdict — mid score plus a flag.
 */
export function eraAffinity(
  a: string,
  b: string,
): { score: number; uncertain: boolean } {
  if (a === "vintage-uncertain" || b === "vintage-uncertain") {
    return { score: 0.6, uncertain: true };
  }
  const ia = ERA_ORDER.indexOf(a);
  const ib = ERA_ORDER.indexOf(b);
  if (ia === -1 || ib === -1) return { score: 0.6, uncertain: true };
  const distance = Math.abs(ia - ib);
  if (distance === 0) return { score: 1, uncertain: false };
  if (distance === 1) return { score: 0.85, uncertain: false };
  if (distance === 2) return { score: 0.6, uncertain: false };
  return { score: 0.35, uncertain: false };
}

/* --------------------------------- energy -------------------------------- */

const ENERGY_CLASHES: Array<[string, string, string]> = [
  ["formal", "sporty", "boardroom vs gym — bridge with clean minimal footwear"],
  ["formal", "rugged", "polish vs workwear grit — keep one of them as accent only"],
  ["romantic", "utilitarian", "softness vs function — let fabric carry the romance, cut carry the utility"],
  ["futuristic", "archival", "two eras of 'statement' competing — pick one as the hero"],
];

/** Energy affinity (0–1) + optional clash note. */
export function energyAffinity(
  a: string,
  b: string,
): { score: number; note: string | null } {
  if (a === b) return { score: 1, note: null };
  for (const [x, y, note] of ENERGY_CLASHES) {
    if ((a === x && b === y) || (a === y && b === x)) {
      return { score: 0.35, note };
    }
  }
  return { score: 0.8, note: null };
}

/* ------------------------------ contradiction ---------------------------- */

/**
 * Within one reference set, some attribute combinations contradict each
 * other — §8.8 calls missing this "contradiction_blindness". Returns
 * human-language contradiction notes (empty array = coherent).
 */
export function findContradictions(attributes: {
  silhouette: string[];
  palette: string[];
  energy: string[];
  era: string[];
}): string[] {
  const notes: string[] = [];
  const { silhouette, palette, energy, era } = attributes;

  const hasFitted = silhouette.includes("fitted");
  const hasOversized = silhouette.includes("oversized") || silhouette.includes("boxy");
  if (hasFitted && hasOversized) {
    notes.push(
      "Silhouette conflict: fitted and oversized signals both present — decide which piece carries the volume.",
    );
  }
  if (palette.includes("monochrome") && palette.includes("high-contrast")) {
    notes.push(
      "Palette conflict: monochrome and high-contrast cannot both lead — one must become the accent.",
    );
  }
  for (let i = 0; i < energy.length; i++) {
    for (let j = i + 1; j < energy.length; j++) {
      const affinity = energyAffinity(energy[i], energy[j]);
      if (affinity.note) {
        notes.push(`Energy conflict: ${energy[i]} × ${energy[j]} — ${affinity.note}.`);
      }
    }
  }
  for (let i = 0; i < era.length; i++) {
    for (let j = i + 1; j < era.length; j++) {
      const affinity = eraAffinity(era[i], era[j]);
      if (!affinity.uncertain && affinity.score <= 0.35) {
        notes.push(
          `Era conflict: ${era[i]} vs ${era[j]} is a costume risk unless one era is reduced to a single reference detail.`,
        );
      }
    }
  }
  return notes;
}
