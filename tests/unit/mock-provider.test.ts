import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  MOCK_DISCLOSURE,
  MockAIProvider,
  MalformedAIProvider,
  type AIGenerateRequest,
  type AIProvider,
} from "@/lib/ai/provider";
import { styleNarrativeSchema } from "@/features/style-engine/narrative";

const request: AIGenerateRequest = {
  feature: "style_engine.build_my_fit",
  prompt: {
    id: null,
    feature: "style_engine.build_my_fit",
    version: 1,
    systemPrompt: "test system prompt",
  },
  context: {
    thesisLines: ["The references keep returning to boxy shapes."],
    sharedSignals: ["silhouette:boxy", "palette_role:monochrome"],
    contradictions: [],
    climateNotes: ["Singapore default: breathable layers only."],
    occasion: "daily",
    climate: "hot-humid",
  },
};

describe("MockAIProvider — determinism (A5, §17.3)", () => {
  it("byte-identical output for identical requests", async () => {
    const provider = new MockAIProvider();
    const a = await provider.generateText(request);
    const b = await provider.generateText(request);
    expect(a).toEqual(b);
  });

  it("output is composed from the structured context, not lorem ipsum", async () => {
    const provider = new MockAIProvider();
    const { text } = await provider.generateText(request);
    expect(text).toContain("boxy shapes");
    expect(text).toContain("silhouette:boxy");
    expect(text).toContain("hot-humid");
    expect(text).toContain(MOCK_DISCLOSURE);
  });

  it("different context produces different output (rule-based, not static)", async () => {
    const provider = new MockAIProvider();
    const a = await provider.generateText(request);
    const b = await provider.generateText({
      ...request,
      context: { ...request.context, occasion: "nightlife" },
    });
    expect(b.text).toContain("nightlife");
    expect(a.text).not.toEqual(b.text);
  });

  it("structured output validates against the narrative schema", async () => {
    const provider = new MockAIProvider();
    const result = await provider.generateStructured(request, styleNarrativeSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.narrative).toContain("boxy");
      expect(result.data.disclosure).toBe(MOCK_DISCLOSURE);
    }
  });

  it("structured output is deterministic too", async () => {
    const provider = new MockAIProvider();
    const a = await provider.generateStructured(request, styleNarrativeSchema);
    const b = await provider.generateStructured(request, styleNarrativeSchema);
    expect(a).toEqual(b);
  });

  it("unknown features get a deterministic context echo, never a crash", async () => {
    const provider = new MockAIProvider();
    const { text } = await provider.generateText({
      ...request,
      feature: "unknown.feature",
      context: { alpha: 1, beta: 2 },
    });
    expect(text).toContain("unknown.feature");
    expect(text).toContain("alpha");
    expect(text).toContain(MOCK_DISCLOSURE);
  });

  it("implements the §13.1 surface without analyzeImage/embed (documented absence)", () => {
    const provider: AIProvider = new MockAIProvider();
    expect(typeof provider.generateText).toBe("function");
    expect(typeof provider.generateStructured).toBe("function");
    expect(provider.analyzeImage).toBeUndefined();
    expect(provider.embed).toBeUndefined();
  });
});

describe("MalformedAIProvider — the safe-reject fixture (§19.1)", () => {
  it("structured calls resolve to ok:false, never throw", async () => {
    const provider = new MalformedAIProvider();
    const result = await provider.generateStructured(request, styleNarrativeSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/parseable JSON/);
      expect(result.raw.length).toBeGreaterThan(0);
    }
  });

  it("a real provider shape-mismatch is rejected by the schema contract", async () => {
    // Simulates a provider that returns valid JSON of the wrong shape.
    const provider = new MockAIProvider();
    const wrongSchema = z.object({ definitely_not_narrative: z.number() });
    const result = await provider.generateStructured(request, wrongSchema);
    expect(result.ok).toBe(false);
  });
});
