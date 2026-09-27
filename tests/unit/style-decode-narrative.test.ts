import { describe, expect, it } from "vitest";

import { decodeReference, summarizeDecode } from "@/features/style-engine/decode";
import { enhanceNarrative, styleNarrativeSchema } from "@/features/style-engine/narrative";
import { MalformedAIProvider, MockAIProvider } from "@/lib/ai/provider";

const PROMPT = {
  id: null,
  feature: "style_engine.build_my_fit",
  version: 1,
  systemPrompt: "sys",
};

describe("Decode This Reference (§8.5)", () => {
  it("low-confidence reads are marked uncertain, not asserted", () => {
    const result = decodeReference([
      { dimension: "silhouette", value: "draped", confidence: 0.4, source: "ai_suggestion" },
    ]);
    expect(result.silhouette.uncertain).toBe(true);
    expect(result.uncertainties.join(" ")).toMatch(/provisional/i);
  });

  it("missing dimensions are honestly 'left open', never guessed", () => {
    const result = decodeReference([
      { dimension: "silhouette", value: "boxy", confidence: null, source: "human" },
    ]);
    expect(result.uncertainties.join(" ")).toMatch(/palette.*not readable/i);
  });

  it("separates distinctive from incidental by confidence", () => {
    const result = decodeReference([
      { dimension: "silhouette", value: "boxy", confidence: 0.9, source: "ai_suggestion" },
      { dimension: "material", value: "denim", confidence: 0.5, source: "ai_suggestion" },
    ]);
    expect(result.distinctive).toContain("silhouette:boxy");
    expect(result.incidental).toContain("material:denim");
  });

  it("wool gets a Singapore substitution, linen does not", () => {
    const wool = decodeReference([
      { dimension: "material", value: "wool", confidence: null, source: "human" },
    ]);
    expect(wool.materials.substitutes).toContain("linen");
    expect(wool.climateTranslation.join(" ")).toMatch(/heat trap/i);

    const linen = decodeReference([
      { dimension: "material", value: "linen", confidence: null, source: "human" },
    ]);
    expect(linen.climateTranslation.join(" ")).toMatch(/already translate/i);
  });

  it("human-entered (null confidence) reads are trusted", () => {
    const result = decodeReference([
      { dimension: "era", value: "90s", confidence: null, source: "human" },
    ]);
    expect(result.era.uncertain).toBe(false);
    expect(result.era.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("summary lines name the distinctive signals", () => {
    const decoded = decodeReference([
      { dimension: "silhouette", value: "boxy", confidence: 0.9, source: "ai_suggestion" },
      { dimension: "palette_role", value: "monochrome", confidence: 0.85, source: "ai_suggestion" },
    ]);
    expect(summarizeDecode(decoded).join(" ")).toContain("silhouette:boxy");
  });
});

describe("enhanceNarrative — AI re-words, never re-decides (§13.4)", () => {
  it("valid provider output enhances the deterministic narrative", async () => {
    const outcome = await enhanceNarrative({
      provider: new MockAIProvider(),
      feature: PROMPT.feature,
      prompt: PROMPT,
      context: { thesisLines: ["Boxy shapes."], occasion: "daily", climate: "hot-humid" },
      deterministicNarrative: "Deterministic thesis.",
    });
    expect(outcome.aiEnhanced).toBe(true);
    expect(outcome.narrative).toContain("Deterministic thesis.");
    expect(outcome.narrative).toContain("Boxy shapes.");
    expect(outcome.flags).toEqual([]);
  });

  it("malformed provider output falls back to deterministic + flags it", async () => {
    const outcome = await enhanceNarrative({
      provider: new MalformedAIProvider(),
      feature: PROMPT.feature,
      prompt: PROMPT,
      context: {},
      deterministicNarrative: "Deterministic thesis.",
    });
    expect(outcome.aiEnhanced).toBe(false);
    expect(outcome.narrative).toBe("Deterministic thesis.");
    expect(outcome.flags).toEqual(["malformed_provider_output"]);
    expect(outcome.error).toBeTruthy();
    expect(outcome.rawResponse).toBeTruthy();
  });

  it("null provider (AI disabled) is a clean deterministic pass", async () => {
    const outcome = await enhanceNarrative({
      provider: null,
      feature: PROMPT.feature,
      prompt: PROMPT,
      context: {},
      deterministicNarrative: "Deterministic thesis.",
    });
    expect(outcome.aiEnhanced).toBe(false);
    expect(outcome.narrative).toBe("Deterministic thesis.");
  });

  it("a throwing provider is caught and flagged provider_error", async () => {
    const outcome = await enhanceNarrative({
      provider: {
        name: "exploding",
        model: "x",
        generateText: () => Promise.reject(new Error("boom")),
        generateStructured: () => Promise.reject(new Error("boom")),
      },
      feature: PROMPT.feature,
      prompt: PROMPT,
      context: {},
      deterministicNarrative: "Deterministic thesis.",
    });
    expect(outcome.aiEnhanced).toBe(false);
    expect(outcome.flags).toEqual(["provider_error"]);
  });

  it("narrative schema rejects empty narratives", () => {
    expect(styleNarrativeSchema.safeParse({ narrative: "" }).success).toBe(false);
  });
});
