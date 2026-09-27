/**
 * Provider-neutral AI interface (Build Bible §13.1). Pure module so the mock
 * adapter is unit-testable. Server-side wiring lives in ./index (server-only).
 */

export interface AIGenerateRequest {
  feature: string; // e.g. "description_copy", "reference_decoder"
  prompt: string;
  promptVersion: string;
}

export interface AIGenerateResult {
  text: string;
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  generateText(request: AIGenerateRequest): Promise<AIGenerateResult>;
}

/**
 * Deterministic mock provider (A5) — always available, no network, no cost.
 * Output is explicitly labeled so it can never be mistaken for real AI
 * output; ai_generations rows still require human acceptance (§13.4).
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateText(request: AIGenerateRequest): Promise<AIGenerateResult> {
    return {
      text: `[mock-ai:${request.feature}@v${request.promptVersion}] deterministic placeholder — a real provider (${"kimi/openai/anthropic/local"}) can be configured via AI_PROVIDER.`,
      provider: this.name,
      model: "mock-deterministic",
    };
  }
}
