import type {
  CompatibilityResult,
  DimensionAssessment,
  GarmentProfile,
} from "./types";
import {
  climateIssue,
  eraAffinity,
  energyAffinity,
  formalityScore,
  garmentWarmth,
  paletteHarmony,
  silhouettePairing,
  MATERIAL_SUBSTITUTES,
} from "./rules";

/**
 * Can This Work? (§8.4) — deterministic two-garment comparison across color
 * harmony, silhouette, proportion, material weight, formality, era and
 * energy. Always explains and offers repair moves; the verdict is a
 * threshold over dimension scores, never a vibe.
 */

function pick(values: string[], fallback: string): string {
  return values[0] ?? fallback;
}

export function assessCompatibility(
  a: GarmentProfile,
  b: GarmentProfile,
): CompatibilityResult {
  const assessments: DimensionAssessment[] = [];
  const repairMoves: string[] = [];

  // ---- color harmony ----
  const pa = pick(a.palette, "neutral");
  const pb = pick(b.palette, "neutral");
  const colorScore = paletteHarmony(pa, pb);
  assessments.push({
    dimension: "color",
    score: colorScore,
    note:
      colorScore >= 0.9
        ? `${pa} × ${pb}: the palettes sit together quietly.`
        : `${pa} × ${pb}: two loud palettes compete for the same attention.`,
  });
  if (colorScore < 0.9) {
    repairMoves.push(
      "Quiet one side: swap the louder piece to a neutral version, or repeat one color elsewhere so it reads intentional.",
    );
  }

  // ---- silhouette + proportion ----
  const topFirst = isUpper(a) ? { top: a, bottom: b } : { top: b, bottom: a };
  const pairing = silhouettePairing(
    pick(topFirst.top.silhouette, "straight"),
    pick(topFirst.bottom.silhouette, "straight"),
  );
  assessments.push({ dimension: "silhouette", score: pairing.score, note: pairing.note });
  assessments.push({
    dimension: "proportion",
    score: pairing.score,
    note:
      pairing.score >= 0.9
        ? "The top/bottom lengths balance — the eye finds a waistline."
        : "The lengths fight: neither piece establishes where the body breaks.",
  });
  if (pairing.score < 0.7) {
    repairMoves.push(
      "Reset the proportion: tuck or crop the top, or add a longline layer under a cropped piece to rebuild the line.",
    );
  }

  // ---- material weight ----
  const wa = garmentWarmth(a.material);
  const wb = garmentWarmth(b.material);
  const materialGap = Math.abs(wa - wb);
  const materialScore = materialGap <= 1 ? 1 : materialGap === 2 ? 0.6 : 0.3;
  assessments.push({
    dimension: "material",
    score: materialScore,
    note:
      materialScore === 1
        ? "Fabric weights are in the same register — they hang like they belong together."
        : `Fabric weights are ${materialGap} steps apart (${pick(a.material, "unknown")} vs ${pick(b.material, "unknown")}) — one will look like an afterthought.`,
  });
  if (materialScore < 1) {
    const heavy = wa > wb ? a : b;
    const substitutes = heavy.material.flatMap((m) => MATERIAL_SUBSTITUTES[m] ?? []);
    repairMoves.push(
      substitutes.length
        ? `Swap ${heavy.label} to ${substitutes[0]} — same visual line, lighter hand.`
        : `Rebalance fabric weight: pair the heavier piece with something of similar substance.`,
    );
  }

  // ---- formality ----
  const fa = formalityScore(a);
  const fb = formalityScore(b);
  const formalityGap = Math.abs(fa - fb);
  const formalityResult = formalityGap <= 1 ? 1 : formalityGap === 2 ? 0.6 : 0.3;
  assessments.push({
    dimension: "formality",
    score: formalityResult,
    note:
      formalityResult === 1
        ? "Both pieces live at the same level of dress."
        : `Formality gap (${fa} vs ${fb} on a 1–5 scale) — the outfit can't decide where it's going.`,
  });
  if (formalityResult < 1) {
    repairMoves.push(
      "Anchor the dressier piece with deliberately casual footwear, or add one sharp accessory to pull the casual piece up.",
    );
  }

  // ---- era ----
  const era = eraAffinity(pick(a.era, "contemporary"), pick(b.era, "contemporary"));
  assessments.push({
    dimension: "era",
    score: era.score,
    note: era.uncertain
      ? "One piece is era-uncertain — treat the era read as provisional."
      : era.score >= 0.8
        ? "The era signals agree."
        : "The eras are far apart — this reads as costume unless one era is reduced to a detail.",
  });
  if (!era.uncertain && era.score < 0.6) {
    repairMoves.push(
      "Keep one era as the hero and demote the other to a single detail (a buckle, a collar shape, a wash).",
    );
  }

  // ---- energy ----
  const energy = energyAffinity(pick(a.energy, "clean"), pick(b.energy, "clean"));
  assessments.push({
    dimension: "energy",
    score: energy.score,
    note: energy.note ?? "The energies point in the same direction.",
  });
  if (energy.note) {
    repairMoves.push(energy.note);
  }

  // ---- verdict ----
  const score =
    assessments.reduce((sum, d) => sum + d.score, 0) / assessments.length;
  const verdict =
    score >= 0.75
      ? "compatible"
      : score >= 0.45
        ? "tension_but_usable"
        : "contradictory";

  if (verdict === "compatible" && repairMoves.length === 0) {
    repairMoves.push("No repair needed — wear it as is.");
  }

  return { verdict, score: Math.round(score * 100) / 100, assessments, repairMoves };
}

function isUpper(g: GarmentProfile): boolean {
  return ["outerwear", "top", "shirt", "knitwear"].includes(g.category ?? "");
}

/**
 * Singapore pre-check (§8.4 + climate): if either piece fails the climate
 * rules, attach the note — the verdict stands but the wearer is warned.
 */
export function climateWarnings(
  garments: GarmentProfile[],
  climate: "hot-humid" | "indoor-aircon" | "mild" | "cold",
): string[] {
  const notes: string[] = [];
  for (const g of garments) {
    const issue = climateIssue(g.material, climate);
    if (issue) notes.push(`${g.label}: ${issue.note}`);
  }
  return notes;
}
