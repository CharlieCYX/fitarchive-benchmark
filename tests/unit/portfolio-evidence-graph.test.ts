import { describe, expect, it } from "vitest";

import {
  EVIDENCE_STAGES,
  assembleEvidenceGraph,
  validateEvidenceLink,
} from "@/features/portfolio/evidence-graph";
import type { EvidenceLink } from "@/features/portfolio/snapshot";

const link = (partial: Partial<EvidenceLink>): EvidenceLink => ({
  stage: "research",
  label: "label",
  ref_table: null,
  ref_id: null,
  href: null,
  ...partial,
});

describe("evidence graph assembly (§21.1)", () => {
  it("orders nodes into the canonical research→…→next_action chain", () => {
    const graph = assembleEvidenceGraph([
      link({ stage: "decision", label: "Mid-price assortment" }),
      link({ stage: "research", label: "24 listings", ref_table: "source_listings", ref_id: "r1" }),
      link({ stage: "next_action", label: "Drop #002 plan" }),
      link({ stage: "campaign", label: "6 tracked links", ref_table: "campaigns", ref_id: "c1" }),
    ]);
    expect(graph.nodes.map((n) => n.stage)).toEqual(["research", "campaign", "decision", "next_action"]);
    expect(graph.chainSummary).toBe("Research → Campaign → Decision → Next action");
  });

  it("collapses exact duplicates and labels detached notes", () => {
    const graph = assembleEvidenceGraph([
      link({ stage: "drop", label: "Drop #001", ref_table: "drops", ref_id: "d1" }),
      link({ stage: "drop", label: "Drop #001", ref_table: "drops", ref_id: "d1" }),
      link({ stage: "insight", label: "Mid-price strength" }),
    ]);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes.find((n) => n.stage === "drop")?.attached).toBe(true);
    expect(graph.nodes.find((n) => n.stage === "insight")?.attached).toBe(false);
  });

  it("every stage constant is usable", () => {
    for (const stage of EVIDENCE_STAGES) {
      expect(validateEvidenceLink(link({ stage }))).toBeNull();
    }
  });
});

describe("evidence link validation", () => {
  it("rejects refs that do not fit the stage", () => {
    expect(
      validateEvidenceLink(link({ stage: "research", ref_table: "campaigns", ref_id: "c1" })),
    ).toMatch(/cannot reference/);
    expect(
      validateEvidenceLink(link({ stage: "campaign", ref_table: "campaigns", ref_id: "c1" })),
    ).toBeNull();
  });

  it("requires ref_table and ref_id to be set together", () => {
    expect(validateEvidenceLink(link({ ref_table: "drops" }))).toMatch(/together/);
    expect(validateEvidenceLink(link({ ref_id: "d1" }))).toMatch(/together/);
  });

  it("requires a non-empty label", () => {
    expect(validateEvidenceLink(link({ label: "  " }))).toMatch(/label/);
  });
});
