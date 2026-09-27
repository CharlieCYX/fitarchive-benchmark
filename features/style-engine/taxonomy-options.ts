/**
 * Taxonomy options for style forms (DATA_MODEL.md §3 seed values). Pure
 * module — imported by client components and tests.
 */

export const SILHOUETTE_OPTIONS = [
  "boxy", "cropped", "fitted", "oversized", "relaxed", "straight",
  "wide", "flared", "tapered", "draped", "structured",
] as const;

export const PALETTE_OPTIONS = [
  "neutral", "monochrome", "low-contrast", "high-contrast", "accent-color",
  "earth", "jewel", "pastel", "metallic",
] as const;

export const MATERIAL_OPTIONS = [
  "cotton", "denim", "leather", "wool", "knit", "nylon", "polyester",
  "linen", "silk", "rayon-viscose", "mesh", "mixed-unknown",
] as const;

export const ENERGY_OPTIONS = [
  "clean", "sharp", "soft", "rugged", "romantic", "sporty", "futuristic",
  "archival", "playful", "formal", "utilitarian",
] as const;

export const ERA_OPTIONS = [
  "70s", "80s", "90s", "2000s-y2k", "contemporary", "vintage-uncertain",
] as const;

export const AESTHETIC_OPTIONS = [
  "streetwear", "minimal", "workwear", "blokecore", "blokette", "gorpcore",
  "darkwear", "prep", "romantic", "techwear", "archival", "tailored", "other",
] as const;

export const CATEGORY_OPTIONS = [
  "outerwear", "top", "shirt", "knitwear", "trouser", "denim", "skirt",
  "dress", "footwear", "bag", "accessory", "other",
] as const;

export const OCCASION_OPTIONS = [
  "daily", "work", "nightlife", "event", "travel", "active", "editorial",
  "special-occasion",
] as const;

export const CLIMATE_OPTIONS = [
  { value: "hot-humid", label: "Singapore — hot & humid (default)" },
  { value: "indoor-aircon", label: "Mostly indoor / aircon" },
  { value: "mild", label: "Mild" },
  { value: "cold", label: "Cold" },
] as const;

export const FEEDBACK_LABELS = [
  { value: "nailed_it", label: "Nailed it" },
  { value: "too_costume", label: "Too costume" },
  { value: "too_hot", label: "Too hot for SG" },
  { value: "wrong_silhouette", label: "Wrong silhouette" },
  { value: "wrong_budget", label: "Wrong budget" },
  { value: "other", label: "Other" },
] as const;

export const FAILURE_MODE_OPTIONS = [
  { value: "constraint_miss", label: "Constraint miss" },
  { value: "hallucinated_inventory", label: "Invented inventory" },
  { value: "cosplay_overfit", label: "Cosplay overfit" },
  { value: "contradiction_blindness", label: "Missed contradiction" },
  { value: "unsupported_certainty", label: "Unsupported certainty" },
  { value: "preference_miss", label: "Preference miss" },
] as const;
