import { describe, expect, it } from "vitest";

import { normalizeSourceUrl } from "@/features/research/urls";

describe("normalizeSourceUrl (§7.2 duplicate detection)", () => {
  it("lowercases scheme and host", () => {
    expect(normalizeSourceUrl("HTTPS://WWW.Carousell.SG/p/jacket-123")).toBe(
      "https://carousell.sg/p/jacket-123",
    );
  });

  it("strips tracking params and fragments", () => {
    expect(
      normalizeSourceUrl(
        "https://carousell.sg/p/jacket-123/?utm_source=ig&fbclid=abc123&ref=share#comments",
      ),
    ).toBe("https://carousell.sg/p/jacket-123");
  });

  it("keeps meaningful params and sorts them for stable dedupe", () => {
    const a = normalizeSourceUrl("https://shop.sg/item?color=black&size=m");
    const b = normalizeSourceUrl("https://shop.sg/item?size=m&color=black");
    expect(a).toBe("https://shop.sg/item?color=black&size=m");
    expect(a).toBe(b);
  });

  it("treats two captures of the same listing as duplicates", () => {
    const first = normalizeSourceUrl(
      "https://www.carousell.sg/p/vintage-dickies-874-1298834711/?utm_campaign=share",
    );
    const second = normalizeSourceUrl(
      "https://carousell.sg/p/vintage-dickies-874-1298834711?utm_medium=share",
    );
    expect(first).toBe(second);
  });

  it("removes trailing slashes but keeps the root path", () => {
    expect(normalizeSourceUrl("https://instagram.com/seller/")).toBe(
      "https://instagram.com/seller",
    );
    expect(normalizeSourceUrl("https://instagram.com/")).toBe("https://instagram.com/");
  });

  it("returns null for missing, invalid or non-http URLs", () => {
    expect(normalizeSourceUrl("")).toBeNull();
    expect(normalizeSourceUrl(null)).toBeNull();
    expect(normalizeSourceUrl("   ")).toBeNull();
    expect(normalizeSourceUrl("not a url")).toBeNull();
    expect(normalizeSourceUrl("ftp://example.com/x")).toBeNull();
  });

  it("drops default ports but keeps non-default ones", () => {
    expect(normalizeSourceUrl("https://example.com:443/a")).toBe("https://example.com/a");
    expect(normalizeSourceUrl("http://localhost:3000/a")).toBe("http://localhost:3000/a");
  });
});
