import { z } from "zod";

/**
 * Ideation-round provenance (§9.4 + §13.3) — pure module, unit-tested.
 *
 * Every AI ideation round stores: the prompt, the references the operator
 * supplied, the generated output, the selection criteria, operator comments
 * and a link to the full ai_generations provenance row. This module builds
 * the round record and validates that provenance is complete before insert.
 */

export const ideationOutputSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().min(1),
        concept: z.string().min(1),
        risks: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  disclosure: z.string().optional(),
});

export type IdeationOutput = z.infer<typeof ideationOutputSchema>;

export interface IdeationRoundRecord {
  garment_project_id: string;
  round_number: number;
  prompt_text: string;
  reference_notes: string | null;
  selection_criteria: string | null;
  operator_comments: string | null;
  ai_generation_id: string | null;
}

export interface IdeationProvenanceInput {
  garmentProjectId: string;
  existingRoundNumbers: number[];
  promptText: string;
  referenceNotes: string | null;
  selectionCriteria: string | null;
  operatorComments: string | null;
  aiGenerationId: string | null;
}

/**
 * Build a round record. Rounds are numbered sequentially per project
 * (next = max + 1) so the ideation history reads as an ordered trail.
 */
export function buildIdeationRound(input: IdeationProvenanceInput): IdeationRoundRecord {
  return {
    garment_project_id: input.garmentProjectId,
    round_number: input.existingRoundNumbers.length
      ? Math.max(...input.existingRoundNumbers) + 1
      : 1,
    prompt_text: input.promptText,
    reference_notes: input.referenceNotes,
    selection_criteria: input.selectionCriteria,
    operator_comments: input.operatorComments,
    ai_generation_id: input.aiGenerationId,
  };
}

/**
 * Provenance completeness gate (§9.4): a round is only complete when the
 * prompt is recorded AND the ai_generations row exists. Selection criteria
 * may be added later, but prompt + provenance are non-negotiable.
 */
export function ideationProvenanceIssues(round: IdeationRoundRecord): string[] {
  const issues: string[] = [];
  if (!round.prompt_text.trim()) issues.push("prompt_text is required — the exact prompt is part of the record.");
  if (round.ai_generation_id === null) {
    issues.push("ai_generation_id is missing — the round has no §13.3 provenance row.");
  }
  return issues;
}
