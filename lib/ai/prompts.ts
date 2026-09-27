/**
 * Prompt registry (§13: FitArchive owns its prompts). Pure module.
 *
 * The registry is the source of truth when the database is unavailable; when
 * Supabase is configured, `ai_prompt_versions` rows seeded from these exact
 * strings are used so every ai_generations row can reference
 * `prompt_version_id`. Keep `feature` + `version` in sync with
 * `supabase/seeds/06_ai_insights.sql` and `supabase/seeds/12_ai_style.sql`.
 */

export interface PromptVersionSeed {
  feature: string;
  version: number;
  system_prompt: string;
  user_template: string;
}

export const PROMPT_REGISTRY: readonly PromptVersionSeed[] = [
  {
    feature: "style_engine.build_my_fit",
    version: 1,
    system_prompt:
      "You are FitArchive's style engine. Never invent inventory; only reference provided items. Singapore climate first.",
    user_template:
      "References: {{references}}. Occasion: {{occasion}}. Climate: {{climate}}. Budget: {{budget}}. Owned: {{owned_items}}.",
  },
  {
    feature: "style_engine.can_this_work",
    version: 1,
    system_prompt:
      "You compare two garments across color, silhouette, proportion, material weight, formality, era and energy. Verdicts: compatible, tension-but-usable, contradictory. Always give repair moves. Never invent items.",
    user_template:
      "Item A: {{item_a}}. Item B: {{item_b}}. Climate: {{climate}}. Question: {{question}}.",
  },
  {
    feature: "style_engine.decode_reference",
    version: 1,
    system_prompt:
      "You decode style references into silhouette, palette, materials, era and energy with explicit confidence. Mark uncertain reads. Separate distinctive signals from incidental ones. Translate to Singapore climate.",
    user_template:
      "Reference note: {{note}}. Attributes: {{attributes}} (each with source + confidence).",
  },
  {
    feature: "catalog.description_assistant",
    version: 1,
    system_prompt:
      "Draft factual product descriptions. Never alter condition_grade or invent provenance.",
    user_template:
      "Product: {{title}}. Condition notes: {{defect_notes}}. Measurements: {{measurements}}.",
  },
  {
    feature: "campaign.copy_assistant",
    version: 1,
    system_prompt:
      "Draft editorial campaign copy. Sparse, assertive; no exclamation marks.",
    user_template: "Drop: {{drop_name}}. Concept: {{concept}}. Channel: {{channel}}.",
  },
  {
    feature: "ai_lab.eval",
    version: 1,
    system_prompt:
      "Evaluation harness runs. Output must satisfy the case's expected constraints; violations are recorded as failure modes.",
    user_template: "Case: {{case_id}}. Input: {{input}}. Expected constraints: {{expected}}.",
  },
] as const;

/** Latest registry entry for a feature (versions are monotonic). */
export function latestPromptFor(feature: string): PromptVersionSeed | null {
  const candidates = PROMPT_REGISTRY.filter((p) => p.feature === feature);
  if (!candidates.length) return null;
  return candidates.reduce((a, b) => (b.version > a.version ? b : a));
}

/** Render a user template by substituting {{key}} with context values. */
export function renderUserTemplate(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = context[key];
    if (value === undefined || value === null) return "—";
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

/** Feature keys the AI Lab harness is allowed to run (§13.5). */
export const KNOWN_FEATURES = PROMPT_REGISTRY.map((p) => p.feature).filter(
  (feature, index, all) => all.indexOf(feature) === index,
);
