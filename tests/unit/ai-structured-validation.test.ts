import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractJson, validateStructuredOutput } from "@/lib/ai/provider";
import { aiGenerateRequestSchema, styleGenerateSchema } from "@/lib/validation/style";

const narrativeSchema = z.object({
  narrative: z.string().min(1),
  disclosure: z.string().optional(),
});

describe("validateStructuredOutput (§16 AI contract: valid + invalid)", () => {
  it("accepts clean JSON", () => {
    const result = validateStructuredOutput(
      '{"narrative":"Boxy over wide."}',
      narrativeSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("accepts fenced JSON (```json … ```)", () => {
    const result = validateStructuredOutput(
      '```json\n{"narrative":"Boxy over wide."}\n```',
      narrativeSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("extracts JSON from surrounding prose", () => {
    const result = validateStructuredOutput(
      'Here you go! {"narrative":"Boxy over wide."} Hope this helps.',
      narrativeSchema,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects pure prose safely", () => {
    const result = validateStructuredOutput("No JSON here at all.", narrativeSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/parseable JSON/);
  });

  it("rejects truncated JSON safely", () => {
    const result = validateStructuredOutput('{"narrative":"cut off', narrativeSchema);
    expect(result.ok).toBe(false);
  });

  it("rejects valid JSON of the wrong shape with schema detail", () => {
    const result = validateStructuredOutput('{"narrative":42}', narrativeSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/schema validation/);
  });
});

describe("extractJson", () => {
  it("returns null for empty input", () => {
    expect(extractJson("")).toBeNull();
  });
});

describe("gateway + style payload schemas (API map §23.2)", () => {
  it("ai/generate: defaults mode to text and validates feature", () => {
    const parsed = aiGenerateRequestSchema.safeParse({ feature: "style_engine.build_my_fit" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.mode).toBe("text");
  });

  it("ai/generate: rejects junk", () => {
    expect(aiGenerateRequestSchema.safeParse({}).success).toBe(false);
    expect(aiGenerateRequestSchema.safeParse({ feature: "" }).success).toBe(false);
  });

  it("style/generate: build payload defaults climate to hot-humid (Singapore)", () => {
    const parsed = styleGenerateSchema.safeParse({
      mode: "build_my_fit",
      references: [[{ dimension: "silhouette", value: "boxy" }]],
      occasion: "daily",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.mode === "build_my_fit") {
      expect(parsed.data.climate).toBe("hot-humid");
      expect(parsed.data.references[0][0].source).toBe("human");
    }
  });

  it("style/generate: rejects 0 or 6+ references (§8.3 says 1–5 usable)", () => {
    const base = { mode: "build_my_fit", occasion: "daily" };
    expect(styleGenerateSchema.safeParse({ ...base, references: [] }).success).toBe(false);
    const six = Array.from({ length: 6 }, () => [{ dimension: "silhouette", value: "boxy" }]);
    expect(styleGenerateSchema.safeParse({ ...base, references: six }).success).toBe(false);
  });

  it("style/generate: rejects unknown modes", () => {
    expect(
      styleGenerateSchema.safeParse({ mode: "make_me_cool", references: [] }).success,
    ).toBe(false);
  });

  it("style/generate: rejects non-slug attribute values (no free-text tags)", () => {
    const parsed = styleGenerateSchema.safeParse({
      mode: "decode_reference",
      attributes: [{ dimension: "silhouette", value: "Kinda Baggy!!" }],
    });
    expect(parsed.success).toBe(false);
  });
});
