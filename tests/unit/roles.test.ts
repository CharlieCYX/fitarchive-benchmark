import { describe, expect, it } from "vitest";
import {
  APP_ROLES,
  canAccessArchive,
  canAccessSellerPortal,
  canAccessStudio,
  canReadAnalytics,
  isValidRole,
} from "@/lib/auth/roles";

describe("role model (DATA_MODEL.md §1)", () => {
  it("defines exactly the six spec roles", () => {
    expect(APP_ROLES).toEqual(["owner", "seller", "shopper", "stylist", "analyst", "viewer"]);
  });

  it("validates roles strictly", () => {
    expect(isValidRole("owner")).toBe(true);
    expect(isValidRole("viewer")).toBe(true);
    expect(isValidRole("admin")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
    expect(isValidRole(42)).toBe(false);
  });
});

describe("authorization guards (server-enforced)", () => {
  it("studio is owner-only in V1 (A6)", () => {
    expect(canAccessStudio("owner")).toBe(true);
    for (const role of ["seller", "shopper", "stylist", "analyst", "viewer"] as const) {
      expect(canAccessStudio(role)).toBe(false);
    }
  });

  it("seller portal admits sellers and the owner only", () => {
    expect(canAccessSellerPortal("seller")).toBe(true);
    expect(canAccessSellerPortal("owner")).toBe(true);
    expect(canAccessSellerPortal("shopper")).toBe(false);
    expect(canAccessSellerPortal("analyst")).toBe(false);
  });

  it("analytics are owner + scoped analyst read (A6)", () => {
    expect(canReadAnalytics("owner")).toBe(true);
    expect(canReadAnalytics("analyst")).toBe(true);
    expect(canReadAnalytics("shopper")).toBe(false);
    expect(canReadAnalytics("viewer")).toBe(false);
  });

  it("archive is any signed-in profile except viewers", () => {
    expect(canAccessArchive("shopper")).toBe(true);
    expect(canAccessArchive("viewer")).toBe(false);
  });
});
