import type { AttributeSignal, DecodedBreakdown, TaxonomyDimension } from "./types";
import { climateIssue, MATERIAL_SUBSTITUTES, materialWarmth } from "./rules";

/**
 * Decode This Reference (§8.5) — deterministic structured breakdown from
 * decoded attributes. Every read carries confidence + uncertainty; signals
 * are separated into distinctive (the look depends on them) vs incidental
 * (present but replaceable); materials get a Singapore-climate translation.
 */

const LOW_CONFIDENCE = 0.6;
const DISTINCTIVE_CONFIDENCE = 0.7;

interface DimensionRead {
  values: string[];
  confidence: number;
  uncertain: boolean;
}

function readDimension(
  attributes: AttributeSignal[],
  dimension: TaxonomyDimension,
): DimensionRead {
  const signals = attributes.filter((a) => a.dimension === dimension);
  if (!signals.length) return { values: [], confidence: 0, uncertain: true };
  // AI-suggested attributes carry their confidence; human tags are trusted.
  const confidences = signals.map((s) =>
    s.confidence === null ? 0.95 : s.confidence,
  );
  const confidence =
    Math.round(
      (confidences.reduce((sum, c) => sum + c, 0) / confidences.length) * 100,
    ) / 100;
  return {
    values: [...new Set(signals.map((s) => s.value))],
    confidence,
    uncertain: confidence < LOW_CONFIDENCE,
  };
}

export function decodeReference(attributes: AttributeSignal[]): DecodedBreakdown {
  const silhouette = readDimension(attributes, "silhouette");
  const palette = readDimension(attributes, "palette_role");
  const materials = readDimension(attributes, "material");
  const era = readDimension(attributes, "era");
  const energy = readDimension(attributes, "energy");
  const aesthetic = readDimension(attributes, "aesthetic");

  const reads: Array<[string, DimensionRead]> = [
    ["silhouette", silhouette],
    ["palette", palette],
    ["material", materials],
    ["era", era],
    ["energy", energy],
    ["aesthetic", aesthetic],
  ];

  const distinctive: string[] = [];
  const incidental: string[] = [];
  const uncertainties: string[] = [];
  for (const [name, read] of reads) {
    if (!read.values.length) {
      uncertainties.push(`${name}: not readable from this reference — left open rather than guessed.`);
      continue;
    }
    if (read.uncertain) {
      uncertainties.push(
        `${name}: low-confidence read (${read.confidence.toFixed(2)}) — treat ${read.values.join(", ")} as provisional.`,
      );
    }
    for (const value of read.values) {
      const label = `${name}:${value}`;
      if (read.confidence >= DISTINCTIVE_CONFIDENCE) distinctive.push(label);
      else incidental.push(label);
    }
  }

  // Singapore-climate translation (§8.5): heavy materials get breathable
  // substitutes; layered silhouettes get an aircon note.
  const climateTranslation: string[] = [];
  const substitutes = new Set<string>();
  for (const material of materials.values) {
    const issue = climateIssue([material], "hot-humid");
    if (issue?.severity === "reject") {
      for (const sub of MATERIAL_SUBSTITUTES[material] ?? []) substitutes.add(sub);
      climateTranslation.push(
        `${material} (warmth ${materialWarmth(material)}/5) is a heat trap in Singapore — swap to ${(MATERIAL_SUBSTITUTES[material] ?? ["lighter fabric"]).join(" or ")} in the same cut.`,
      );
    } else if (issue?.severity === "caution") {
      climateTranslation.push(`${material} is workable but warm — keep it to aircon hours or evening wear.`);
    }
  }
  if (silhouette.values.some((s) => s === "oversized" || s === "draped")) {
    climateTranslation.push(
      "Keep the volume but lose the lining: unlined construction keeps the silhouette without the insulation.",
    );
  }
  if (!climateTranslation.length) {
    climateTranslation.push(
      "The materials already translate to Singapore — no substitution needed.",
    );
  }

  return {
    silhouette,
    palette,
    materials: {
      values: materials.values,
      confidence: materials.confidence,
      uncertain: materials.uncertain,
      substitutes: [...substitutes],
    },
    era,
    energy,
    aesthetic,
    distinctive,
    incidental,
    climateTranslation,
    uncertainties,
  };
}

/** One-line human summary used as the deterministic narrative base. */
export function summarizeDecode(b: DecodedBreakdown): string[] {
  const lines: string[] = [];
  if (b.silhouette.values.length) {
    lines.push(
      `Silhouette reads ${b.silhouette.values.join(" + ")}${b.silhouette.uncertain ? " (provisional)" : ""}.`,
    );
  }
  if (b.palette.values.length) {
    lines.push(`Palette sits ${b.palette.values.join(" + ")}.`);
  }
  if (b.era.values.length) {
    lines.push(
      `Era: ${b.era.values.join(", ")}${b.era.uncertain ? " — flagged uncertain rather than asserted" : ""}.`,
    );
  }
  if (b.distinctive.length) {
    lines.push(
      `The look depends on: ${b.distinctive.join(", ")}. Everything else (${b.incidental.join(", ") || "nothing flagged"}) is incidental and replaceable.`,
    );
  }
  return lines;
}
