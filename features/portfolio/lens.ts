/**
 * Portfolio role lenses (§21) — pure module.
 * The same evidence graph is reframed per role; the lens changes emphasis,
 * never the underlying evidence.
 */

export const ROLE_LENSES = [
  "merchandising",
  "buying",
  "ecommerce",
  "analytics",
  "fashion_tech",
  "garment",
  "kpop_merch",
  "creative",
] as const;

export type RoleLens = (typeof ROLE_LENSES)[number];

export const ROLE_LENS_LABELS: Record<RoleLens, string> = {
  merchandising: "Merchandising / MD",
  buying: "Buying",
  ecommerce: "E-commerce / growth",
  analytics: "Analytics / strategy",
  fashion_tech: "Fashion-tech / product",
  garment: "Garment development",
  kpop_merch: "K-pop merch / IP",
  creative: "Creative production",
};

/** What the lens foregrounds in the frozen case study (display copy). */
export const ROLE_LENS_EMPHASIS: Record<RoleLens, string> = {
  merchandising: "Assortment architecture, price ladder, sell-through and the research→drop loop.",
  buying: "Sourcing evidence, permission discipline, cost-vs-price judgement.",
  ecommerce: "Conversion path, tracked links, instrumentation and iteration speed.",
  analytics: "Metric definitions, sample sizes, evidence strength and honest limits.",
  fashion_tech: "System design: how the tooling made the loop legible and repeatable.",
  garment: "Problem framing, simulated vs physical evidence, prototype discrepancies.",
  kpop_merch: "IP-adjacent demand signals, drop mechanics, fan-community channels.",
  creative: "Concept, art direction and campaign execution artifacts.",
};

export function isRoleLens(value: unknown): value is RoleLens {
  return typeof value === "string" && (ROLE_LENSES as readonly string[]).includes(value);
}
