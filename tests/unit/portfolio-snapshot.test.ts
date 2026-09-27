import { describe, expect, it } from "vitest";

import {
  SNAPSHOT_FIELD_ALLOWLIST,
  assertNoPrivateFields,
  assertSnapshotImmutable,
  buildFrozenPayload,
  findPrivateKeyPaths,
  frozenPayloadSchema,
  nextSnapshotVersion,
  snapshotSlug,
  type FrozenPayloadInput,
} from "@/features/portfolio/snapshot";

const baseInput: FrozenPayloadInput = {
  title: "Drop #001: research-to-sell-through loop",
  oneLineProblem: "Can a tiny secondhand drop be run as a measurable experiment?",
  roleLens: "merchandising",
  roleLensEmphasis: "Assortment architecture, price ladder, sell-through.",
  contribution: "Solo: sourcing, pricing, campaign, analytics.",
  contextConstraints: "Zero ad spend; n=12.",
  evidenceGraph: [
    { stage: "research", label: "24 listings", ref_table: "source_listings", ref_id: "abc", href: null },
    { stage: "decision", label: "Mid-price assortment", ref_table: null, ref_id: null, href: null },
  ],
  evidenceSummary: "24 listings → 14 products → 12-item drop.",
  decision: "Mid-price cropped/boxy over premium/oversized.",
  artifacts: [
    { kind: "image", caption: "Drop grid", asset_path: "public-assets/portfolio/grid.png", url: null, sort_order: 1 },
  ],
  resultMetrics: [
    { key: "sell_through", label: "Sell-through", value: 0.75, period: "2026-08-15..2026-09-15", sample_size: 12 },
  ],
  whatChangedNext: "Drop #002 doubles down on entry band.",
  limitations: "Single drop; directional only.",
  links: ["https://fitarchive.sg/drops/drop-001"],
  koDraft: null,
  koReviewed: false,
  frozenAt: "2026-09-25T09:00:00.000Z",
  sourceProjectId: "51000000-0000-4000-8000-000000000001",
};

describe("frozen payload assembly (§21.2)", () => {
  it("builds a payload containing exactly the §21.2 allowlisted fields", () => {
    const payload = buildFrozenPayload(baseInput);
    expect(Object.keys(payload).sort()).toEqual(
      SNAPSHOT_FIELD_ALLOWLIST.filter((k) => k !== "synthetic_demo_data"),
    );
    expect(payload.schema_version).toBe(1);
    expect(frozenPayloadSchema.parse(payload)).toBeTruthy();
  });

  it("flags KO drafts as machine-assisted until reviewed (§13.4)", () => {
    const draft = buildFrozenPayload({ ...baseInput, koDraft: "초안", koReviewed: false });
    expect(draft.ko_machine_assisted).toBe(true);
    const reviewed = buildFrozenPayload({ ...baseInput, koDraft: "검토 완료", koReviewed: true });
    expect(reviewed.ko_machine_assisted).toBe(false);
    const none = buildFrozenPayload(baseInput);
    expect(none.ko_machine_assisted).toBe(false);
  });

  it("rejects an unknown role lens instead of freezing it", () => {
    expect(() => buildFrozenPayload({ ...baseInput, roleLens: "ceo" })).toThrow();
  });
});

describe("private-field stripping (§15.2)", () => {
  it("allowlist: only §21.2 keys survive — private source fields never enter the payload", () => {
    const payload = buildFrozenPayload(baseInput);
    const json = JSON.stringify(payload);
    for (const forbidden of [
      "cost_basis_sgd",
      "notes_private",
      "seller_email",
      "buyer_contact",
      "raw_response_private",
      "phone",
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });

  it("denylist guard: detects private keys nested anywhere in a payload", () => {
    const dirty = {
      title: "x",
      artifacts: [{ caption: "ok", cost_basis_sgd: 12.5 }],
      nested: { seller: { seller_email: "a@b.co" } },
      metrics: [{ key: "gmv", buyer_phone: "9111" }],
    };
    const hits = findPrivateKeyPaths(dirty);
    expect(hits).toContain("artifacts[0].cost_basis_sgd");
    expect(hits).toContain("nested.seller.seller_email");
    expect(hits).toContain("metrics[0].buyer_phone");
    expect(assertNoPrivateFields(dirty)).not.toBeNull();
  });

  it("a clean §21.2 payload passes the guard", () => {
    expect(assertNoPrivateFields(buildFrozenPayload(baseInput))).toBeNull();
  });
});

describe("freeze versioning + immutability (§6.4 rule 8)", () => {
  it("versions are monotonic and slugs are unique per version", () => {
    expect(nextSnapshotVersion([])).toBe(1);
    expect(nextSnapshotVersion([1, 3, 2])).toBe(4);
    expect(snapshotSlug("drop001-merch-case", 2)).toBe("drop001-merch-case-v2");
    expect(snapshotSlug("drop001-merch-case", 2)).not.toBe(snapshotSlug("drop001-merch-case", 1));
  });

  it("frozen snapshots reject payload/version/frozen_at mutation", () => {
    const frozen = { frozen_at: "2026-09-25T09:00:00.000Z" };
    expect(() => assertSnapshotImmutable(frozen, { frozen_payload: {} })).toThrow(/frozen/);
    expect(() => assertSnapshotImmutable(frozen, { version: 2 })).toThrow(/frozen/);
    expect(() =>
      assertSnapshotImmutable(frozen, { frozen_at: "2027-01-01T00:00:00.000Z" }),
    ).toThrow(/frozen/);
  });

  it("visibility flips (publish/unpublish) do NOT violate immutability", () => {
    const frozen = { frozen_at: "2026-09-25T09:00:00.000Z" };
    expect(() => assertSnapshotImmutable(frozen, {})).not.toThrow();
  });

  it("unfrozen rows (pre-freeze) may still be written", () => {
    expect(() =>
      assertSnapshotImmutable({ frozen_at: null }, { frozen_payload: {}, version: 1 }),
    ).not.toThrow();
  });
});
