/**
 * AI Lab rating dimensions (§13.5) — pure module so both the server action
 * and client components can import them ("use server" files export only
 * async functions).
 */
export const RATING_DIMENSIONS = [
  "grounding",
  "constraint_adherence",
  "truthfulness",
  "utility",
  "style_quality",
  "reproducibility",
] as const;

export type RatingDimension = (typeof RATING_DIMENSIONS)[number];

export const RATING_DIMENSION_LABELS: Record<RatingDimension, string> = {
  grounding: "Grounding — every claim traces to the inputs/catalog",
  constraint_adherence: "Constraint adherence — budget, climate, availability respected",
  truthfulness: "Truthfulness — no invented inventory or certainty",
  utility: "Utility — the output changes what you'd do",
  style_quality: "Style quality — reads like an editor, not a thesaurus",
  reproducibility: "Reproducibility — same inputs, same output",
};
