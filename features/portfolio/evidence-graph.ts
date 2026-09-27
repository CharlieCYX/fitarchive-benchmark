import type { EvidenceLink } from "./snapshot";

/**
 * Evidence graph assembly (§21.1) — pure module, unit-tested.
 *
 * A portfolio case study links REAL project objects in the order the work
 * actually happened: research → product/drop → campaign → events/metrics →
 * insight → decision → next action. This module orders and validates the
 * links; it never fabricates a stage the operator did not record (case
 * studies must never be detached narrative).
 */

export const EVIDENCE_STAGES = [
  "research",
  "product",
  "drop",
  "campaign",
  "events_metrics",
  "insight",
  "decision",
  "next_action",
] as const;

export type EvidenceStage = (typeof EVIDENCE_STAGES)[number];

export const EVIDENCE_STAGE_LABELS: Record<EvidenceStage, string> = {
  research: "Research",
  product: "Product",
  drop: "Drop",
  campaign: "Campaign",
  events_metrics: "Events / metrics",
  insight: "Insight",
  decision: "Decision",
  next_action: "Next action",
};

const STAGE_ORDER: Record<EvidenceStage, number> = Object.fromEntries(
  EVIDENCE_STAGES.map((stage, i) => [stage, i]),
) as Record<EvidenceStage, number>;

/**
 * Tables a link may point at — real project objects only, keyed to the
 * studio route that shows them. `null` ref = an external/manual note with a
 * label (allowed, but labeled as such).
 */
export const EVIDENCE_REF_TARGETS: Record<EvidenceStage, string[]> = {
  research: ["source_listings", "research_observations"],
  product: ["products"],
  drop: ["drops"],
  campaign: ["campaigns", "tracked_links"],
  events_metrics: ["metric_snapshots", "events"],
  insight: ["insights", "experiments"],
  decision: ["insights", "experiments", "drop_hypotheses"],
  next_action: ["drops", "experiments", "product_briefs", "garment_projects"],
};

export interface EvidenceGraphNode extends EvidenceLink {
  /** True when the link points at a real record; false for manual notes. */
  attached: boolean;
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  /** Stages present, in canonical order (for rendering the chain). */
  stages: EvidenceStage[];
  /** Human-readable summary: "research → drop → decision → next action". */
  chainSummary: string;
}

/**
 * Assemble the graph: stable-sorted into canonical stage order, duplicates
 * (same stage + ref) collapsed, each node labeled attached/detached.
 */
export function assembleEvidenceGraph(links: EvidenceLink[]): EvidenceGraph {
  const seen = new Set<string>();
  const unique = links.filter((link) => {
    const key = `${link.stage}:${link.ref_table ?? ""}:${link.ref_id ?? ""}:${link.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const nodes: EvidenceGraphNode[] = unique
    .map((link) => ({ ...link, attached: link.ref_table !== null && link.ref_id !== null }))
    .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]);
  const stages = EVIDENCE_STAGES.filter((stage) => nodes.some((n) => n.stage === stage));
  return {
    nodes,
    stages,
    chainSummary: stages.map((s) => EVIDENCE_STAGE_LABELS[s]).join(" → "),
  };
}

/**
 * Validate a link before insert: stage must be known; when ref_table/ref_id
 * are given they must point at a table allowed for that stage.
 */
export function validateEvidenceLink(link: EvidenceLink): string | null {
  if (!EVIDENCE_STAGES.includes(link.stage)) return `Unknown evidence stage "${link.stage}".`;
  if (!link.label.trim()) return "Evidence link label is required.";
  if ((link.ref_table === null) !== (link.ref_id === null)) {
    return "ref_table and ref_id must be set together (or both empty for a manual note).";
  }
  if (link.ref_table && !EVIDENCE_REF_TARGETS[link.stage].includes(link.ref_table)) {
    return `Stage "${link.stage}" cannot reference ${link.ref_table}; allowed: ${EVIDENCE_REF_TARGETS[link.stage].join(", ")}.`;
  }
  return null;
}
