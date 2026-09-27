import { describe, expect, it } from "vitest";

import {
  classifyChannel,
  formatCount,
  formatIntervalDays,
  formatRate,
  formatSampleSize,
  intervalToDays,
} from "@/lib/metrics/format";
import {
  CONCLUSION_STRENGTHS,
  EVIDENCE_STATES,
  EXPERIMENT_STATUSES,
  canTransition,
  concludeError,
  transitionError,
} from "@/features/analytics/evidence";
import { insightSchema } from "@/lib/validation/analytics";

describe("metric formatting (§2 honesty rules)", () => {
  it("formats ratios as percents", () => {
    expect(formatRate(0.1234)).toBe("12.3%");
    expect(formatRate("0.5", 0)).toBe("50%");
    expect(formatRate(1, 0)).toBe("100%");
  });

  it("never fabricates a zero rate from null", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(undefined)).toBe("—");
    expect(formatRate("")).toBe("—");
    expect(formatRate("abc")).toBe("—");
  });

  it("formats counts and sample sizes", () => {
    expect(formatCount(1234)).toBe("1,234");
    expect(formatCount(null)).toBe("—");
    expect(formatSampleSize(12)).toBe("n = 12");
    expect(formatSampleSize(null)).toBe("n = —");
  });

  it("parses Postgres interval text into days", () => {
    expect(intervalToDays("5 days")).toBe(5);
    expect(intervalToDays("1 day 12:00:00")).toBe(1.5);
    expect(intervalToDays("12:00:00")).toBe(0.5);
    expect(intervalToDays("00:00:00")).toBe(0);
    expect(intervalToDays("P3D")).toBe(3);
    expect(intervalToDays("nonsense")).toBeNull();
    expect(intervalToDays(null)).toBeNull();
  });

  it("formats median time-to-sale as days (median, not mean)", () => {
    expect(formatIntervalDays("10 days 12:00:00")).toBe("10.5 days");
    expect(formatIntervalDays(null)).toBe("—");
  });
});

describe("channel attribution grouping (§12.3)", () => {
  it("tracked-link UTM wins", () => {
    expect(classifyChannel({ utm_source: "instagram" })).toBe("social");
    expect(classifyChannel({ utm_source: "Carousell" })).toBe("referral");
    expect(classifyChannel({ utm_source: "ssqrd" })).toBe("referral");
    expect(classifyChannel({ utm_medium: "referral", utm_source: "newsletter-x" })).toBe("referral");
    expect(classifyChannel({ utm_source: "newsletter" })).toBe("other");
  });

  it("falls back to referrer host", () => {
    expect(classifyChannel({ referrer: "https://www.instagram.com/p/abc" })).toBe("social");
    expect(classifyChannel({ referrer: "https://www.carousell.sg/p/1" })).toBe("referral");
    expect(classifyChannel({ referrer: "https://unknown-blog.example/post" })).toBe("other");
    expect(classifyChannel({ referrer: "https://fitarchive.sg/drops" })).toBe("direct");
  });

  it("no signal is direct; junk referrer is direct-ish other", () => {
    expect(classifyChannel({})).toBe("direct");
    expect(classifyChannel({ referrer: "not a url" })).toBe("direct");
  });
});

describe("evidence states (§9.2)", () => {
  it("forecast is not a selectable evidence state", () => {
    expect(EVIDENCE_STATES).not.toContain("forecast");
    expect(EVIDENCE_STATES).toEqual([
      "observation",
      "hypothesis",
      "experiment",
      "validated_result",
    ]);
  });

  it("insight validation rejects forecast even though the DB enum has it", () => {
    const bad = insightSchema.safeParse({ type: "forecast", title: "Sales will double" });
    expect(bad.success).toBe(false);
    const good = insightSchema.safeParse({
      type: "observation",
      title: "Mid-band outsold premium",
      confidence: "0.7",
      sample_size: "12",
    });
    expect(good.success).toBe(true);
    if (good.success) {
      expect(good.data.confidence).toBe(0.7);
      expect(good.data.sample_size).toBe(12);
    }
  });
});

describe("experiment lifecycle (§12.4)", () => {
  it("statuses and conclusion strengths match the DB enums", () => {
    expect(EXPERIMENT_STATUSES).toEqual(["draft", "running", "paused", "concluded", "abandoned"]);
    expect(CONCLUSION_STRENGTHS).toEqual(["inconclusive", "directional", "repeated_evidence"]);
  });

  it("legal transitions only; concluded/abandoned are terminal", () => {
    expect(canTransition("draft", "running")).toBe(true);
    expect(canTransition("running", "paused")).toBe(true);
    expect(canTransition("paused", "running")).toBe(true);
    expect(canTransition("running", "concluded")).toBe(true);
    expect(canTransition("draft", "concluded")).toBe(false);
    expect(canTransition("concluded", "running")).toBe(false);
    expect(canTransition("abandoned", "draft")).toBe(false);
    expect(transitionError("concluded", "running")).toMatch(/terminal/);
    expect(transitionError("draft", "draft")).toMatch(/already/);
  });

  it("concluding requires running/paused + written conclusion + strength", () => {
    expect(concludeError("draft", "long enough conclusion text", "directional")).toMatch(/running or paused/);
    expect(concludeError("running", "short", "directional")).toMatch(/at least 10/);
    expect(concludeError("running", "long enough conclusion text", null)).toMatch(/strength/);
    expect(concludeError("running", "long enough conclusion text", "inconclusive")).toBeNull();
  });
});
