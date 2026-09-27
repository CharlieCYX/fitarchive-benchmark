import { describe, expect, it } from "vitest";

import {
  allowedPermissionTransitions,
  canPublishProduct,
  isPermissionValid,
  PERMISSION_STATES,
  permissionBlockReason,
} from "@/features/sellers/permissions";

const NOW = new Date("2026-09-01T00:00:00Z");

describe("permission states (§5.2)", () => {
  it("defines exactly the 8 spec states", () => {
    expect(PERMISSION_STATES).toHaveLength(8);
    expect(PERMISSION_STATES).toContain("observed_only");
    expect(PERMISSION_STATES).toContain("expired_revoked");
  });

  it("lifecycle: observed_only → contacted → a grant state", () => {
    expect(allowedPermissionTransitions("observed_only")).toEqual(["contacted"]);
    expect(allowedPermissionTransitions("contacted")).toContain("permission_consignment");
    expect(allowedPermissionTransitions("expired_revoked")).toEqual([]);
  });
});

describe("isPermissionValid (§7.4)", () => {
  it("accepts an active consignment grant", () => {
    expect(
      isPermissionValid(
        { state: "permission_consignment", granted_at: "2026-08-01T00:00:00Z" },
        NOW,
      ),
    ).toBe(true);
  });

  it("rejects non-grant states", () => {
    expect(isPermissionValid({ state: "observed_only" }, NOW)).toBe(false);
    expect(isPermissionValid({ state: "contacted" }, NOW)).toBe(false);
  });

  it("rejects revoked permissions", () => {
    expect(
      isPermissionValid(
        { state: "owned", revoked_at: "2026-08-15T00:00:00Z" },
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects expired permissions but accepts future expiry", () => {
    expect(
      isPermissionValid(
        { state: "borrowed_for_content", expires_at: "2026-08-01T00:00:00Z" },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPermissionValid(
        { state: "borrowed_for_content", expires_at: "2026-12-01T00:00:00Z" },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("canPublishProduct — publish gate (§7.4 AC)", () => {
  it("owned products need no permission row", () => {
    expect(canPublishProduct({ ownershipState: "owned", permission: null }, NOW).ok).toBe(true);
  });

  it("blocks non-owned products with no permission", () => {
    const result = canPublishProduct({ ownershipState: "observed_only", permission: null }, NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no permission/);
  });

  it("blocks non-owned products with a revoked permission", () => {
    const result = canPublishProduct(
      {
        ownershipState: "permission_consignment",
        permission: { state: "permission_consignment", revoked_at: "2026-08-01T00:00:00Z" },
      },
      NOW,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/revoked/);
  });

  it("blocks when ownership itself is expired/revoked", () => {
    const result = canPublishProduct(
      { ownershipState: "expired_revoked", permission: { state: "owned" } },
      NOW,
    );
    expect(result.ok).toBe(false);
  });

  it("allows consigned products with a valid grant", () => {
    expect(
      canPublishProduct(
        {
          ownershipState: "permission_consignment",
          permission: { state: "permission_consignment", granted_at: "2026-08-01T00:00:00Z" },
        },
        NOW,
      ).ok,
    ).toBe(true);
  });
});

describe("permissionBlockReason wording", () => {
  it("names the exact failure", () => {
    expect(permissionBlockReason(null, NOW)).toMatch(/no permission record/);
    expect(permissionBlockReason({ state: "contacted" }, NOW)).toMatch(/not a grant/);
    expect(
      permissionBlockReason(
        { state: "owned", expires_at: "2026-01-01T00:00:00Z" },
        NOW,
      ),
    ).toMatch(/expired/);
  });
});
