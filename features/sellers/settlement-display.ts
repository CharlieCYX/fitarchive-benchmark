/**
 * Settlement / payout display logic (§10.4, DATA_MODEL.md §6).
 * Pure module — unit-tested in tests/unit/settlement-display.test.ts.
 * The math itself lives in lib/metrics/settlement.ts (canonical); this module
 * only governs how terms and payouts are WORDED so the UI never says
 * "profit" (Build Bible §10.4 honesty rule).
 */

import { formatSgd } from "@/lib/utils";

export interface AgreementTermsLike {
  type: string;
  seller_share_pct?: number | string | null;
  seller_fixed_amount_sgd?: number | string | null;
}

/** Human-readable seller terms, e.g. "60% of sale price" or "SGD 40.00 fixed". */
export function describeSellerTerms(agreement: AgreementTermsLike): string {
  const pct =
    agreement.seller_share_pct === null || agreement.seller_share_pct === undefined
      ? null
      : Number(agreement.seller_share_pct);
  const fixed =
    agreement.seller_fixed_amount_sgd === null ||
    agreement.seller_fixed_amount_sgd === undefined
      ? null
      : Number(agreement.seller_fixed_amount_sgd);

  const parts: string[] = [];
  if (fixed !== null && Number.isFinite(fixed)) {
    parts.push(`${formatSgd(fixed)} fixed`);
  }
  if (pct !== null && Number.isFinite(pct)) {
    parts.push(`${pct}% of sale price`);
  }

  const terms = parts.length > 0 ? parts.join(" + ") : "no payout terms recorded";
  const typeLabel =
    agreement.type === "content_collaboration" ? "content collaboration" : agreement.type;
  return `${typeLabel} — ${terms}`;
}

/**
 * Canonical label for the FitArchive side of a settlement. NEVER "net profit"
 * (§10.4): overhead, labor, returns and unsold inventory are excluded.
 */
export const CONTRIBUTION_LABEL = "FitArchive contribution";
export const CONTRIBUTION_DISCLAIMER =
  "Excludes overhead, labor, returns and unsold inventory.";

export function settlementStatusLabel(status: string): string {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending payout";
  return status;
}

export interface SettlementLike {
  gross_sale_sgd?: number | string | null;
  platform_fees_sgd?: number | string | null;
  seller_base_sgd?: number | string | null;
  fitarchive_gross_sgd?: number | string | null;
  fitarchive_contribution_sgd?: number | string | null;
}

/**
 * Display rows for a settlement, in canonical §6 order, with the contribution
 * honestly labeled. Values come from the stored settlement row (ADR-008:
 * dashboards never recompute).
 */
export function settlementDisplayRows(
  s: SettlementLike,
): Array<{ label: string; value: string }> {
  return [
    { label: "Gross sale", value: formatSgd(s.gross_sale_sgd) },
    { label: "Platform fees", value: formatSgd(s.platform_fees_sgd) },
    { label: "Seller base", value: formatSgd(s.seller_base_sgd) },
    { label: "FitArchive gross", value: formatSgd(s.fitarchive_gross_sgd) },
    { label: CONTRIBUTION_LABEL, value: formatSgd(s.fitarchive_contribution_sgd) },
  ];
}
