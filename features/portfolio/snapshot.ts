import { z } from "zod";
import { isRoleLens } from "./lens";

/**
 * Frozen snapshot payload (§21.2) + private-field stripping (§15.2, §6.4
 * rule 8) — pure module, unit-tested.
 *
 * Two-layer defense:
 *  1. `buildFrozenPayload` copies ONLY the §21.2 allowlisted fields from the
 *     assembled case-study input — private operational fields never enter the
 *     payload, even when present on the source objects.
 *  2. `assertNoPrivateFields` recursively scans the finished payload for
 *     denylisted key patterns (buyer contacts, seller private notes, cost
 *     basis, internal financials, raw AI responses) and refuses to freeze if
 *     any slipped through.
 */

/* ------------------------------------------------------------------ */
/* §21.2 snapshot field schema                                         */
/* ------------------------------------------------------------------ */

export const resultMetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  period: z.string().min(1), // e.g. "2026-08-15..2026-09-15"
  sample_size: z.number().int().nonnegative().nullable(),
});

export const evidenceLinkSchema = z.object({
  stage: z.enum([
    "research",
    "product",
    "drop",
    "campaign",
    "events_metrics",
    "insight",
    "decision",
    "next_action",
  ]),
  label: z.string().min(1),
  ref_table: z.string().nullable(),
  ref_id: z.string().nullable(),
  href: z.string().nullable(),
});

export const publicArtifactSchema = z.object({
  kind: z.enum(["image", "chart", "link", "metric_snapshot"]),
  caption: z.string().nullable(),
  asset_path: z.string().nullable(),
  url: z.string().nullable(),
  sort_order: z.number().int(),
});

export const frozenPayloadSchema = z.object({
  schema_version: z.literal(1),
  title: z.string().min(1),
  one_line_problem: z.string().nullable(),
  role_lens: z.string().refine(isRoleLens, { message: "Unknown role lens." }),
  role_lens_emphasis: z.string(),
  contribution: z.string().nullable(),
  context_constraints: z.string().nullable(),
  evidence_graph: z.array(evidenceLinkSchema),
  evidence_summary: z.string().nullable(),
  decision: z.string().nullable(),
  artifacts: z.array(publicArtifactSchema),
  result_metrics: z.array(resultMetricSchema),
  what_changed_next: z.string().nullable(),
  limitations: z.string().nullable(),
  links: z.array(z.string()),
  ko_draft: z.string().nullable(),
  /** §13.4: KO draft is machine-assisted until a human reviews it. */
  ko_machine_assisted: z.boolean(),
  frozen_at: z.string(),
  source_project_id: z.string(),
  synthetic_demo_data: z.boolean().optional(),
});

export type FrozenPayload = z.infer<typeof frozenPayloadSchema>;
export type ResultMetric = z.infer<typeof resultMetricSchema>;
export type EvidenceLink = z.infer<typeof evidenceLinkSchema>;
export type PublicArtifact = z.infer<typeof publicArtifactSchema>;

/** The exact §21.2 allowlist — the only keys a frozen payload may carry. */
export const SNAPSHOT_FIELD_ALLOWLIST = Object.keys(
  frozenPayloadSchema.shape,
).sort() as string[];

/* ------------------------------------------------------------------ */
/* Private-field denylist (§15.2)                                      */
/* ------------------------------------------------------------------ */

/**
 * Key patterns that must NEVER appear in a public snapshot: buyer contacts,
 * seller private notes, cost basis, internal financials, raw AI payloads.
 * Matched case-insensitively against every key in the payload tree.
 */
export const PRIVATE_KEY_PATTERNS: readonly RegExp[] = [
  /cost_basis/i,
  /notes_private/i,
  /private_note/i,
  /seller_(email|phone|contact)/i,
  /buyer_(email|phone|contact|name)/i,
  /contact_(email|phone)/i,
  /\bemail\b/i,
  /\bphone\b/i,
  /raw_response_private/i,
  /service_role/i,
  /bank|payout_account/i,
  /internal_(financials|margin|cost)/i,
];

/** Recursively collect denylisted key paths; [] means the payload is clean. */
export function findPrivateKeyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findPrivateKeyPaths(item, `${path}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    const hits: string[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;
      if (PRIVATE_KEY_PATTERNS.some((re) => re.test(key))) hits.push(childPath);
      hits.push(...findPrivateKeyPaths(child, childPath));
    }
    return hits;
  }
  return [];
}

/**
 * Refuse to freeze when any private key slipped through (§15.2). Returns
 * null when clean, otherwise the offending key paths.
 */
export function assertNoPrivateFields(payload: unknown): string[] | null {
  const hits = findPrivateKeyPaths(payload);
  return hits.length ? hits : null;
}

/* ------------------------------------------------------------------ */
/* Payload assembly (allowlist copy)                                   */
/* ------------------------------------------------------------------ */

export interface FrozenPayloadInput {
  title: string;
  oneLineProblem: string | null;
  roleLens: string;
  roleLensEmphasis: string;
  contribution: string | null;
  contextConstraints: string | null;
  evidenceGraph: EvidenceLink[];
  evidenceSummary: string | null;
  decision: string | null;
  artifacts: PublicArtifact[];
  resultMetrics: ResultMetric[];
  whatChangedNext: string | null;
  limitations: string | null;
  links: string[];
  koDraft: string | null;
  koReviewed: boolean;
  frozenAt: string; // ISO — injected so the pure module has no clock
  sourceProjectId: string;
  syntheticDemoData?: boolean;
}

/**
 * Assemble the frozen payload from the explicit §21.2 fields only. The KO
 * draft is carried with its machine-assisted flag — a draft that was never
 * human-reviewed is always flagged (§13.4).
 */
export function buildFrozenPayload(input: FrozenPayloadInput): FrozenPayload {
  if (!isRoleLens(input.roleLens)) {
    throw new Error(`Unknown role lens "${input.roleLens}" — refusing to freeze (§21).`);
  }
  const roleLens = input.roleLens;
  const payload: FrozenPayload = {
    schema_version: 1,
    title: input.title,
    one_line_problem: input.oneLineProblem,
    role_lens: roleLens,
    role_lens_emphasis: input.roleLensEmphasis,
    contribution: input.contribution,
    context_constraints: input.contextConstraints,
    evidence_graph: input.evidenceGraph,
    evidence_summary: input.evidenceSummary,
    decision: input.decision,
    artifacts: input.artifacts,
    result_metrics: input.resultMetrics,
    what_changed_next: input.whatChangedNext,
    limitations: input.limitations,
    links: input.links,
    ko_draft: input.koDraft,
    ko_machine_assisted: input.koDraft !== null && !input.koReviewed,
    frozen_at: input.frozenAt,
    source_project_id: input.sourceProjectId,
    ...(input.syntheticDemoData !== undefined
      ? { synthetic_demo_data: input.syntheticDemoData }
      : {}),
  };
  // Validate before returning — a bad payload must never reach the DB.
  return frozenPayloadSchema.parse(payload);
}

/* ------------------------------------------------------------------ */
/* Freeze versioning (pure half of the frozen-snapshot rule)           */
/* ------------------------------------------------------------------ */

/**
 * Next snapshot version + slug. Snapshots are append-only: a regeneration
 * creates version N+1 with a NEW slug; existing rows are never mutated
 * (enforced in the DB by protect_frozen_snapshot, §6.4 rule 8).
 */
export function nextSnapshotVersion(existingVersions: number[]): number {
  return existingVersions.length ? Math.max(...existingVersions) + 1 : 1;
}

export function snapshotSlug(projectSlug: string, version: number): string {
  return `${projectSlug}-v${version}`;
}

/**
 * Immutability check used before any attempted update: once `frozen_at` is
 * set, payload/version/frozen_at changes are rejected. Mirrors the DB
 * trigger so application code fails with the same rule (unit-tested here;
 * the trigger is the enforcement layer — Phase 2 harness verified it).
 */
export function assertSnapshotImmutable(
  existing: { frozen_at: string | null },
  update: { frozen_payload?: unknown; version?: number; frozen_at?: string | null },
): void {
  if (existing.frozen_at === null) return;
  if (
    update.frozen_payload !== undefined ||
    update.version !== undefined ||
    (update.frozen_at !== undefined && update.frozen_at !== existing.frozen_at)
  ) {
    throw new Error(
      "portfolio_snapshots are frozen and append-only (§6.4 rule 8); create a new version row instead",
    );
  }
}
