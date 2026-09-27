/**
 * Drop readiness gate (§10.2) — the 16 checks as a pure, testable function.
 * The Drop Builder page renders this checklist; the publish server action
 * re-evaluates it server-side and BLOCKS when any check fails
 * (IMPLEMENTATION_PLAN Phase 3 exit condition).
 *
 * 14 checks are computed from data. Two checks (personas documented,
 * rollback verified) have no schema storage in Phase 3 and require explicit
 * operator attestation at publish time — the attestation is part of the
 * publish form and is never assumed (see KNOWN_LIMITATIONS).
 *
 * Unit-tested in tests/unit/readiness-gate.test.ts.
 */

import { canPublishProduct, type PermissionLike, type PermissionState } from "../sellers/permissions";

export interface ReadinessItemInput {
  productId: string;
  title: string;
  tier: "entry" | "core" | "hero";
  /** price_override_sgd ?? products.public_price_sgd */
  effectivePriceSgd: number | null;
  conditionGrade: string | null;
  measurementCount: number;
  /** public-privacy product assets with alt_text */
  publicAssetCount: number;
  descriptionPublic: string | null;
  ownershipState: PermissionState | null;
  permission: PermissionLike | null;
  /** active agreement fulfillment_responsibility (null when owned / no seller) */
  fulfillmentResponsibility: string | null;
  /** active agreement return_terms (null when owned / no seller) */
  returnTerms: string | null;
  /** seller-provenance assets missing rights_note */
  assetsMissingRightsNote: number;
  /** product availability status */
  availability: string;
}

export interface ReadinessInput {
  concept: string | null;
  itemCount: number;
  targetSizeMin: number | null;
  targetSizeMax: number | null;
  items: ReadinessItemInput[];
  /** tracked_links across campaigns attached to this drop */
  trackedLinkCount: number;
  /** metric_definitions rows present (event/metric registry installed) */
  metricDefinitionsCount: number;
  /** events tagged with this drop (test traffic reaching the dashboard) */
  dropEventCount: number;
  attestations: { personas: boolean; rollback: boolean };
  now?: Date;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  /** manual checks require operator attestation at publish time */
  manual: boolean;
  detail: string;
}

export interface ReadinessResult {
  checks: ReadinessCheck[];
  passed: boolean;
  failedCount: number;
}

function check(
  key: string,
  label: string,
  passed: boolean,
  detail: string,
  manual = false,
): ReadinessCheck {
  return { key, label, passed, detail, manual };
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const now = input.now ?? new Date();
  const items = input.items;
  const checks: ReadinessCheck[] = [];

  // 1. Concept
  checks.push(
    check(
      "concept",
      "Concept defined",
      Boolean(input.concept && input.concept.trim().length > 0),
      input.concept ? "Concept recorded." : "Write the drop concept before publishing.",
    ),
  );

  // 2. Personas (manual attestation — no personas table in the V1 schema)
  checks.push(
    check(
      "personas",
      "Target personas documented",
      input.attestations.personas,
      input.attestations.personas
        ? "Operator attested personas are documented."
        : "Requires operator attestation at publish (no personas storage in V1 schema).",
      true,
    ),
  );

  // 3. Size within target range
  const sizeOk =
    input.itemCount > 0 &&
    (input.targetSizeMin === null || input.itemCount >= input.targetSizeMin) &&
    (input.targetSizeMax === null || input.itemCount <= input.targetSizeMax);
  checks.push(
    check(
      "size",
      "Assortment size within target",
      sizeOk,
      input.itemCount === 0
        ? "Drop has no items."
        : `${input.itemCount} items (target ${
            input.targetSizeMin ?? "?"
          }–${input.targetSizeMax ?? "?"}).`,
    ),
  );

  // 4. Tiers: at least one entry and one hero anchor the ladder
  const hasEntry = items.some((i) => i.tier === "entry");
  const hasHero = items.some((i) => i.tier === "hero");
  checks.push(
    check(
      "tiers",
      "Tier spread (entry + hero present)",
      hasEntry && hasHero,
      hasEntry && hasHero
        ? "Entry and hero tiers represented."
        : `Missing: ${[!hasEntry ? "entry" : null, !hasHero ? "hero" : null]
            .filter(Boolean)
            .join(", ")}.`,
    ),
  );

  // 5. Permissions / ownership for every non-owned item
  const permissionFailures = items
    .map((i) => ({ item: i, gate: canPublishProduct({ ownershipState: i.ownershipState, permission: i.permission }, now) }))
    .filter((r) => !r.gate.ok);
  checks.push(
    check(
      "permissions",
      "Permissions valid for all items",
      permissionFailures.length === 0,
      permissionFailures.length === 0
        ? "Every item is owned or has a valid permission."
        : permissionFailures
            .map((r) => `${r.item.title}: ${r.gate.reason}`)
            .join("; "),
    ),
  );

  // 6. Media rights: seller-provenance assets need a rights note
  const rightsFailures = items.filter((i) => i.assetsMissingRightsNote > 0);
  checks.push(
    check(
      "media_rights",
      "Media rights documented",
      rightsFailures.length === 0,
      rightsFailures.length === 0
        ? "No undocumented seller media."
        : rightsFailures
            .map((i) => `${i.title}: ${i.assetsMissingRightsNote} seller asset(s) missing rights_note`)
            .join("; "),
    ),
  );

  // 7. Measurements + condition on every item
  const measurementFailures = items.filter(
    (i) => !i.conditionGrade || i.measurementCount === 0,
  );
  checks.push(
    check(
      "measurements_condition",
      "Measurements + condition grade on every item",
      measurementFailures.length === 0,
      measurementFailures.length === 0
        ? "All items graded and measured."
        : measurementFailures
            .map(
              (i) =>
                `${i.title}: ${[!i.conditionGrade ? "no condition grade" : null, i.measurementCount === 0 ? "no measurements" : null].filter(Boolean).join(", ")}`,
            )
            .join("; "),
    ),
  );

  // 8. Pricing / economics: every item priced
  const priceFailures = items.filter(
    (i) => i.effectivePriceSgd === null || i.effectivePriceSgd <= 0,
  );
  checks.push(
    check(
      "pricing",
      "Every item priced",
      priceFailures.length === 0,
      priceFailures.length === 0
        ? "All items have an effective price."
        : priceFailures.map((i) => `${i.title}: no price`).join("; "),
    ),
  );

  // 9. Descriptions
  const descriptionFailures = items.filter(
    (i) => !i.descriptionPublic || i.descriptionPublic.trim().length === 0,
  );
  checks.push(
    check(
      "descriptions",
      "Public description on every item",
      descriptionFailures.length === 0,
      descriptionFailures.length === 0
        ? "All items have a public description."
        : descriptionFailures.map((i) => i.title).join(", ") + " missing.",
    ),
  );

  // 10. Assets: at least one public asset with alt text per item
  const assetFailures = items.filter((i) => i.publicAssetCount === 0);
  checks.push(
    check(
      "assets",
      "Public imagery with alt text on every item",
      assetFailures.length === 0,
      assetFailures.length === 0
        ? "All items have public imagery with alt text."
        : assetFailures.map((i) => i.title).join(", ") + " missing public asset/alt text.",
    ),
  );

  // 11. Tracked links exist for the drop's campaigns
  checks.push(
    check(
      "tracked_links",
      "Tracked links generated",
      input.trackedLinkCount > 0,
      input.trackedLinkCount > 0
        ? `${input.trackedLinkCount} tracked link(s) on drop campaigns.`
        : "No tracked links yet — generate at least one in Campaign Studio.",
    ),
  );

  // 12. Instrumentation: metric registry installed
  checks.push(
    check(
      "instrumentation",
      "Metric registry installed",
      input.metricDefinitionsCount > 0,
      input.metricDefinitionsCount > 0
        ? `${input.metricDefinitionsCount} metric definitions registered.`
        : "metric_definitions is empty — apply migration 0015.",
    ),
  );

  // 13. Fulfillment responsibility known for every consigned/referred item
  const fulfillmentFailures = items.filter(
    (i) => i.ownershipState !== "owned" && i.fulfillmentResponsibility === null && i.permission !== null,
  );
  checks.push(
    check(
      "fulfillment",
      "Fulfillment responsibility assigned",
      fulfillmentFailures.length === 0,
      fulfillmentFailures.length === 0
        ? "Owned or agreement specifies fulfillment."
        : fulfillmentFailures.map((i) => `${i.title}: agreement missing fulfillment_responsibility`).join("; "),
    ),
  );

  // 14. Returns wording on agreements for non-owned items
  const returnsFailures = items.filter(
    (i) => i.ownershipState !== "owned" && i.returnTerms === null && i.permission !== null,
  );
  checks.push(
    check(
      "returns_wording",
      "Returns wording recorded",
      returnsFailures.length === 0,
      returnsFailures.length === 0
        ? "Owned or agreement specifies return terms."
        : returnsFailures.map((i) => `${i.title}: agreement missing return_terms`).join("; "),
    ),
  );

  // 15. Dashboard receiving test events for this drop
  checks.push(
    check(
      "test_events",
      "Dashboard receiving test events",
      input.dropEventCount > 0,
      input.dropEventCount > 0
        ? `${input.dropEventCount} event(s) tagged with this drop.`
        : "No events tagged with this drop yet — send test traffic before launch.",
    ),
  );

  // 16. Rollback verified (manual attestation)
  checks.push(
    check(
      "rollback",
      "Rollback verified",
      input.attestations.rollback,
      input.attestations.rollback
        ? "Operator attested rollback path is verified."
        : "Requires operator attestation at publish.",
      true,
    ),
  );

  const failedCount = checks.filter((c) => !c.passed).length;
  return { checks, passed: failedCount === 0, failedCount };
}
