/**
 * Feature flags (ASSUMPTIONS A17) — single env-driven module.
 * Keep flags coarse; stretch modules default off.
 */
export const flags = {
  /** AI features run through lib/ai; mock provider always works (A5). */
  aiEnabled: process.env.FEATURE_AI !== "off",
  aiProvider: process.env.AI_PROVIDER ?? "mock",
  /** Demo Checkout = simulated payment state machine (A4). */
  checkoutMode: process.env.FEATURE_CHECKOUT ?? "demo",
  /** Public account creation (magic link) — on in V1. */
  publicAccounts: true,
  /** Stretch labs (A16-style gating). */
  garmentLab: process.env.FEATURE_GARMENT_LAB === "on",
  forecast: false,
} as const;
