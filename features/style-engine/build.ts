import type {
  AttributeSignal,
  BuildInput,
  BuildResult,
  GarmentProfile,
  Recommendation,
  RejectedCandidate,
  TaxonomyDimension,
} from "./types";
import { climateIssue, findContradictions } from "./rules";

/**
 * Build My Fit (§8.3) — deterministic constraint engine.
 *
 * Pipeline: extract shared signals + contradictions from 1–5 reference sets
 * → filter candidates on HARD constraints (availability, budget, rejected
 * silhouettes, climate) → score survivors on signal overlap (owned items
 * first) → assign outfit roles → emit a human-language thesis + confidence.
 *
 * Hard rules (§8.8 failure-mode guards):
 * - catalog items that are not `available` are never recommended;
 * - items over budget are never recommended;
 * - rejected silhouettes are never recommended;
 * - climate-incompatible materials (e.g. wool in hot-humid) are never
 *   recommended — the engine suggests the swap instead.
 */

const SIGNAL_DIMENSIONS: TaxonomyDimension[] = [
  "silhouette",
  "palette_role",
  "material",
  "era",
  "energy",
  "aesthetic",
];

const ROLE_BY_CATEGORY: Record<string, string> = {
  outerwear: "layer",
  top: "base",
  shirt: "base",
  knitwear: "mid-layer",
  trouser: "bottom",
  denim: "bottom",
  skirt: "bottom",
  dress: "hero",
  footwear: "footwear",
  bag: "carry",
  accessory: "accent",
  other: "support",
};

interface SignalMap {
  /** value slug → number of reference sets containing it. */
  counts: Map<string, number>;
}

function collectSignals(
  references: AttributeSignal[][],
): Record<TaxonomyDimension, SignalMap> {
  const byDimension = {} as Record<TaxonomyDimension, SignalMap>;
  for (const dimension of SIGNAL_DIMENSIONS) {
    byDimension[dimension] = { counts: new Map() };
  }
  for (const set of references) {
    const seen = new Set<string>();
    for (const attr of set) {
      if (!SIGNAL_DIMENSIONS.includes(attr.dimension)) continue;
      // One vote per reference set per value (duplicate tags in one set count once).
      const key = `${attr.dimension}:${attr.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const map = byDimension[attr.dimension].counts;
      map.set(attr.value, (map.get(attr.value) ?? 0) + 1);
    }
  }
  return byDimension;
}

function mergedAttributes(references: AttributeSignal[][]): {
  silhouette: string[];
  palette: string[];
  energy: string[];
  era: string[];
} {
  const flat = references.flat();
  const pick = (d: TaxonomyDimension) => [
    ...new Set(flat.filter((a) => a.dimension === d).map((a) => a.value)),
  ];
  return {
    silhouette: pick("silhouette"),
    palette: pick("palette_role"),
    energy: pick("energy"),
    era: pick("era"),
  };
}

function garmentValues(item: GarmentProfile, dimension: TaxonomyDimension): string[] {
  switch (dimension) {
    case "silhouette":
      return item.silhouette;
    case "palette_role":
      return item.palette;
    case "material":
      return item.material;
    case "era":
      return item.era;
    case "energy":
      return item.energy;
    case "aesthetic":
      return [];
    default:
      return [];
  }
}

export function buildMyFit(input: BuildInput): BuildResult {
  const { references, climate, budgetSgd, avoidSilhouettes, ownedItemIds } = input;
  const referenceCount = references.length;
  const signals = collectSignals(references);
  const sharedThreshold = Math.max(2, Math.ceil(referenceCount / 2));

  const sharedSignals: string[] = [];
  const weakSignals: string[] = [];
  for (const dimension of SIGNAL_DIMENSIONS) {
    for (const [value, count] of [...signals[dimension].counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )) {
      if (count >= sharedThreshold) sharedSignals.push(`${dimension}:${value}`);
      else weakSignals.push(`${dimension}:${value}`);
    }
  }

  const contradictions = findContradictions(mergedAttributes(references));
  const insufficientSignal = sharedSignals.length === 0;

  const climateNotes: string[] = [];
  if (climate === "hot-humid") {
    climateNotes.push(
      "Singapore default: layers must be breathable — heavy wools, leather and dense knits are ruled out, not merely discouraged.",
    );
  } else if (climate === "indoor-aircon") {
    climateNotes.push(
      "Aircon logic: one light layer you can shed at the door; nothing that needs a coat over it.",
    );
  }

  // ---- hard-constraint filter + scoring ----
  const rejected: RejectedCandidate[] = [];
  interface Scored {
    item: GarmentProfile;
    score: number;
    matched: string[];
    caution: string | null;
  }
  const scored: Scored[] = [];

  const candidates = [...input.owned, ...input.catalog];
  for (const item of candidates) {
    if (item.source === "catalog" && item.availability !== "available") {
      rejected.push({
        item,
        reason: "unavailable",
        detail: `Availability is "${item.availability ?? "unknown"}" — the engine never recommends items it cannot actually offer.`,
      });
      continue;
    }
    if (
      item.source === "catalog" &&
      budgetSgd !== null &&
      item.priceSgd !== null &&
      item.priceSgd > budgetSgd
    ) {
      rejected.push({
        item,
        reason: "over_budget",
        detail: `${item.priceSgd} SGD exceeds the ${budgetSgd} SGD budget.`,
      });
      continue;
    }
    const blockedSilhouette = item.silhouette.find((s) =>
      avoidSilhouettes.includes(s),
    );
    if (blockedSilhouette) {
      rejected.push({
        item,
        reason: "rejected_silhouette",
        detail: `You ruled out "${blockedSilhouette}" — the engine respects that absolutely.`,
      });
      continue;
    }
    const climateProblem = climateIssue(item.material, climate);
    if (climateProblem?.severity === "reject") {
      rejected.push({
        item,
        reason: "climate_incompatible",
        detail: climateProblem.note,
      });
      continue;
    }

    let score = 0;
    const matched: string[] = [];
    for (const dimension of SIGNAL_DIMENSIONS) {
      for (const value of garmentValues(item, dimension)) {
        const count = signals[dimension].counts.get(value) ?? 0;
        if (count >= sharedThreshold) {
          score += 2;
          matched.push(`${dimension}:${value}`);
        } else if (count > 0) {
          score += 1;
          matched.push(`${dimension}:${value} (weak)`);
        }
      }
    }
    if (item.source === "closet") score += 1; // owned pieces first (§8.3)
    if (ownedItemIds.includes(item.id)) score += 3; // explicitly requested

    scored.push({
      item,
      score,
      matched,
      caution: climateProblem?.severity === "caution" ? climateProblem.note : null,
    });
  }

  // ---- role assignment: best-scoring candidate per role, owned first ----
  const byRole = new Map<string, Scored[]>();
  for (const s of scored) {
    const role = ROLE_BY_CATEGORY[s.item.category ?? "other"] ?? "support";
    const list = byRole.get(role) ?? [];
    list.push(s);
    byRole.set(role, list);
  }

  const recommendations: Recommendation[] = [];
  for (const [role, list] of [...byRole.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const best = [...list].sort(
      (a, b) =>
        b.score - a.score ||
        (a.item.source === "closet" ? -1 : 0) - (b.item.source === "closet" ? -1 : 0) ||
        a.item.id.localeCompare(b.item.id),
    )[0];
    if (!best || best.score <= 0) continue;
    const why = best.matched.length
      ? `Matches ${best.matched.slice(0, 3).join(", ")}.`
      : best.item.source === "closet"
        ? "Already in your closet — neutral base the references can hang on."
        : "Closest catalog match inside your constraints.";
    recommendations.push({
      item: best.item,
      role,
      explanation: [
        why,
        best.item.source === "closet" ? "Owned — wear it first before buying anything." : null,
        best.caution,
      ]
        .filter((x): x is string => Boolean(x))
        .join(" "),
      confidence: confidenceFor(best.score, contradictions.length, insufficientSignal),
    });
  }

  // ---- thesis ----
  const thesisLines: string[] = [];
  if (insufficientSignal) {
    thesisLines.push(
      "The references don't agree enough to read a direction — add one more reference or pick manual tags to sharpen the signal.",
    );
  } else {
    const silhouetteSignal = topSignal(signals.silhouette.counts, sharedThreshold);
    const paletteSignal = topSignal(signals.palette_role.counts, sharedThreshold);
    const energySignal = topSignal(signals.energy.counts, sharedThreshold);
    thesisLines.push(
      [
        "The references keep returning to",
        silhouetteSignal ? `${silhouetteSignal} shapes` : null,
        paletteSignal ? `a ${paletteSignal} palette` : null,
        energySignal ? `with ${energySignal} energy` : null,
      ]
        .filter((x): x is string => Boolean(x))
        .join(" ") + ".",
    );
    thesisLines.push(
      `For "${input.occasion}" in ${climate}, that translates to one statement piece and quiet support — wearable, not costume.`,
    );
  }
  for (const contradiction of contradictions) {
    thesisLines.push(`Tension to resolve: ${contradiction}`);
  }

  const confidence = confidenceFor(
    recommendations.reduce((sum, r) => sum + r.confidence, 0) /
      Math.max(1, recommendations.length),
    contradictions.length,
    insufficientSignal,
  );

  return {
    sharedSignals,
    contradictions,
    thesis: thesisLines.join(" "),
    thesisLines,
    climateNotes,
    recommendations,
    rejected,
    confidence,
    insufficientSignal,
  };
}

function topSignal(counts: Map<string, number>, threshold: number): string | null {
  const sorted = [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return sorted[0]?.[0] ?? null;
}

function confidenceFor(
  score: number,
  contradictions: number,
  insufficientSignal: boolean,
): number {
  if (insufficientSignal) return 0.25;
  const raw = 0.45 + Math.min(0.3, score * 0.05) - contradictions * 0.1;
  return Math.round(Math.min(0.9, Math.max(0.3, raw)) * 100) / 100;
}

/**
 * Score a decoded reference against candidate garments (§8.5 catalog +
 * closet matches). Deterministic: signal overlap only; catalog items must be
 * available to surface.
 */
export function matchGarments(
  signals: string[],
  candidates: GarmentProfile[],
  limit = 4,
): Array<{ item: GarmentProfile; score: number; matched: string[] }> {
  const wanted = new Set(signals);
  const results = candidates
    .map((item) => {
      const values = [
        ...item.silhouette.map((v) => `silhouette:${v}`),
        ...item.palette.map((v) => `palette_role:${v}`),
        ...item.material.map((v) => `material:${v}`),
        ...item.era.map((v) => `era:${v}`),
        ...item.energy.map((v) => `energy:${v}`),
      ];
      const matched = values.filter((v) => wanted.has(v));
      return { item, score: matched.length, matched };
    })
    .filter(
      (r) =>
        r.score > 0 &&
        (r.item.source !== "catalog" || r.item.availability === "available"),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.item.source === "closet" ? -1 : 0) - (b.item.source === "closet" ? -1 : 0) ||
        a.item.id.localeCompare(b.item.id),
    );
  return results.slice(0, limit);
}
