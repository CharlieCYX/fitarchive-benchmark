/**
 * Canonical settlement math (DATA_MODEL.md §6, Build Bible §10.4).
 *
 * Used ONLY when creating settlement rows (write path). Dashboards never
 * recompute settlements — they read `v_fitarchive_contribution` (ADR-008).
 *
 *   seller_base_sgd             = agreement.seller_fixed_amount_sgd
 *                                 OR item_sale_price * seller_share_pct / 100
 *   fitarchive_gross_sgd        = item_sale_price - seller_base_sgd
 *   fitarchive_contribution_sgd = fitarchive_gross_sgd - platform_fees_sgd
 *                                 - shipping_subsidy - campaign_variable_cost
 *
 * All amounts SGD, rounded to cents (numeric(12,2) at the DB boundary).
 */

export interface SettlementInput {
  /** Item sale price in SGD (order_items.unit_price_sgd × quantity). */
  itemSalePriceSgd: number;
  /** Consignment/referral percentage, if the agreement is share-based. */
  sellerSharePct?: number | null;
  /** Fixed payout alternative, if the agreement is fixed-amount. */
  sellerFixedAmountSgd?: number | null;
  /** payment_fee + marketplace_fee + other_transaction_fee (SGD). */
  platformFeesSgd?: number;
  /** FitArchive-funded shipping subsidy (SGD). */
  shippingSubsidySgd?: number;
  /** Variable campaign cost attributed to this sale (SGD). */
  campaignVariableCostSgd?: number;
}

export interface SettlementResult {
  sellerBaseSgd: number;
  fitarchiveGrossSgd: number;
  fitarchiveContributionSgd: number;
}

const cents = (n: number): number => Math.round(n * 100) / 100;

export function computeSettlement(input: SettlementInput): SettlementResult {
  const { itemSalePriceSgd } = input;
  if (!(itemSalePriceSgd >= 0)) {
    throw new Error("itemSalePriceSgd must be >= 0");
  }

  let sellerBase: number;
  if (input.sellerFixedAmountSgd != null) {
    sellerBase = input.sellerFixedAmountSgd;
  } else if (input.sellerSharePct != null) {
    if (input.sellerSharePct < 0 || input.sellerSharePct > 100) {
      throw new Error("sellerSharePct must be within 0–100");
    }
    sellerBase = cents((itemSalePriceSgd * input.sellerSharePct) / 100);
  } else {
    throw new Error("agreement must define seller_share_pct or seller_fixed_amount_sgd");
  }

  const gross = cents(itemSalePriceSgd - sellerBase);
  const contribution = cents(
    gross -
      (input.platformFeesSgd ?? 0) -
      (input.shippingSubsidySgd ?? 0) -
      (input.campaignVariableCostSgd ?? 0),
  );
  return {
    sellerBaseSgd: sellerBase,
    fitarchiveGrossSgd: gross,
    fitarchiveContributionSgd: contribution,
  };
}

/** Simulated demo-checkout fee schedule (ADR-004): 3.4% + SGD 0.50. */
export function demoPaymentFeeSgd(amountSgd: number): number {
  return cents(amountSgd * 0.034 + 0.5);
}
