import { describe, expect, it } from "vitest";

import { buildLinkCode, buildUtmUrl, slugifyPart } from "@/features/campaigns/utm";

describe("tracked-link builder (§7.6)", () => {
  it("appends UTM params to a clean URL", () => {
    const url = buildUtmUrl({
      targetUrl: "https://fitarchive.sg/drops/drop-002",
      source: "Instagram",
      medium: "social",
      campaign: "Drop #002",
      content: "Hero A",
    });
    expect(url).toBe(
      "https://fitarchive.sg/drops/drop-002?utm_source=instagram&utm_medium=social&utm_campaign=drop-002&utm_content=hero-a",
    );
  });

  it("replaces existing utm params instead of duplicating", () => {
    const url = buildUtmUrl({
      targetUrl: "https://fitarchive.sg/?utm_source=old&foo=bar",
      source: "newsletter",
      medium: "email",
      campaign: "drop-002",
    });
    expect(url).toContain("utm_source=newsletter");
    expect(url).toContain("foo=bar");
    expect(url).not.toContain("utm_source=old");
    expect(url).not.toContain("utm_content");
  });

  it("rejects non-http targets", () => {
    expect(
      buildUtmUrl({ targetUrl: "not-a-url", source: "ig", medium: "social", campaign: "x" }),
    ).toBeNull();
    expect(
      buildUtmUrl({ targetUrl: "ftp://x.com/a", source: "ig", medium: "social", campaign: "x" }),
    ).toBeNull();
  });

  it("link code maps campaign + channel + creative deterministically", () => {
    expect(buildLinkCode({ campaign: "Drop #002", channel: "Instagram", content: "Hero A" })).toBe(
      "drop-002-instagram-hero-a",
    );
    expect(buildLinkCode({ campaign: "Drop #002", channel: "newsletter" })).toBe(
      "drop-002-newsletter",
    );
  });

  it("slugifyPart strips unsafe characters", () => {
    expect(slugifyPart("  Blokecore Drop — SG! ")).toBe("blokecore-drop-sg");
  });
});
