import { describe, expect, it } from "vitest";
import { magicLinkSchema } from "@/lib/validation";

describe("magic-link validation (A1)", () => {
  it("accepts a normal email", () => {
    const parsed = magicLinkSchema.safeParse({ email: "operator@fitarchive.sg" });
    expect(parsed.success).toBe(true);
  });

  it("rejects malformed input with a readable message", () => {
    const parsed = magicLinkSchema.safeParse({ email: "not-an-email" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Enter a valid email address.");
    }
  });

  it("rejects missing email", () => {
    expect(magicLinkSchema.safeParse({}).success).toBe(false);
  });
});
