import { describe, expect, it } from "vitest";

import { parseAttribution } from "@/lib/events/attribution";
import { createRateLimiter } from "@/lib/rate-limit";

describe("UTM attribution (§12.1 page_view props)", () => {
  it("extracts the full utm set from URLSearchParams", () => {
    const a = parseAttribution(
      new URLSearchParams(
        "utm_source=ig&utm_medium=bio&utm_campaign=drop001_launch&utm_content=hero",
      ),
    );
    expect(a).toEqual({
      campaign: "drop001_launch",
      utm_source: "ig",
      utm_medium: "bio",
      utm_campaign: "drop001_launch",
      utm_content: "hero",
    });
  });

  it("missing params become null (dictionary nullable)", () => {
    const a = parseAttribution(new URLSearchParams(""));
    expect(a).toEqual({
      campaign: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
    });
  });

  it("accepts plain query records; arrays take the first value", () => {
    const a = parseAttribution({ utm_source: ["ssqrd", "other"], utm_campaign: " midprice_edit " });
    expect(a.utm_source).toBe("ssqrd");
    expect(a.campaign).toBe("midprice_edit"); // trimmed
    expect(a.utm_medium).toBeNull();
  });

  it("empty strings normalize to null", () => {
    const a = parseAttribution({ utm_source: "  " });
    expect(a.utm_source).toBeNull();
  });
});

describe("rate limiter (§15.1)", () => {
  it("allows up to the limit, then blocks with retry-after", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const t0 = 1_000_000;
    expect(limiter.check("ip-1", t0).allowed).toBe(true);
    expect(limiter.check("ip-1", t0 + 100).allowed).toBe(true);
    expect(limiter.check("ip-1", t0 + 200).allowed).toBe(true);
    const blocked = limiter.check("ip-1", t0 + 300);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("windows slide — old hits stop counting", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    expect(limiter.check("k", 0).allowed).toBe(true);
    expect(limiter.check("k", 500).allowed).toBe(true);
    expect(limiter.check("k", 900).allowed).toBe(false);
    expect(limiter.check("k", 1_100).allowed).toBe(true); // t=0 expired
  });

  it("keys are isolated", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });
});
