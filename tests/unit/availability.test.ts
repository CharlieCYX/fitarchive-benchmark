import { describe, expect, it } from "vitest";

import {
  allowedAvailabilityTransitions,
  availabilityTransitionError,
  canTransitionAvailability,
  isSellable,
} from "@/features/catalog/availability";

describe("availability state machine (§7.3, §11.2)", () => {
  it("walks the happy path draft → available → reserved → sold", () => {
    expect(canTransitionAvailability("draft", "available")).toBe(true);
    expect(canTransitionAvailability("available", "reserved")).toBe(true);
    expect(canTransitionAvailability("reserved", "sold")).toBe(true);
  });

  it("allows withdrawal from draft/available/reserved", () => {
    expect(canTransitionAvailability("draft", "withdrawn")).toBe(true);
    expect(canTransitionAvailability("available", "withdrawn")).toBe(true);
    expect(canTransitionAvailability("reserved", "withdrawn")).toBe(true);
  });

  it("allows releasing a reservation back to available", () => {
    expect(canTransitionAvailability("reserved", "available")).toBe(true);
  });

  it("makes sold terminal (returns are commerce, Phase 4)", () => {
    expect(allowedAvailabilityTransitions("sold")).toEqual([]);
    expect(canTransitionAvailability("sold", "available")).toBe(false);
    expect(availabilityTransitionError("sold", "available")).toMatch(/terminal/i);
  });

  it("blocks illegal jumps with a readable reason", () => {
    expect(canTransitionAvailability("draft", "sold")).toBe(false);
    expect(canTransitionAvailability("withdrawn", "available")).toBe(false);
    const reason = availabilityTransitionError("draft", "sold");
    expect(reason).toContain("draft");
    expect(reason).toContain("sold");
  });

  it("withdrawn re-enters via draft only", () => {
    expect(allowedAvailabilityTransitions("withdrawn")).toEqual(["draft"]);
  });

  it("only available items are sellable (stock gating §7.5)", () => {
    expect(isSellable("available")).toBe(true);
    expect(isSellable("reserved")).toBe(false);
    expect(isSellable("draft")).toBe(false);
  });

  it("same-state moves are rejected", () => {
    expect(availabilityTransitionError("available", "available")).toMatch(/already/);
  });
});
