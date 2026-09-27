import "server-only";
import { flags } from "@/lib/config/flags";
import { MockAIProvider, type AIProvider } from "./provider";

/**
 * AI provider gateway (server-only, §13). Real adapters (kimi/openai/…)
 * plug in behind this factory in Phase 7; the mock is the default (A5)
 * and the app must remain fully functional with it.
 */
export function getAIProvider(): AIProvider {
  switch (flags.aiProvider) {
    case "mock":
    default:
      return new MockAIProvider();
  }
}

export type { AIProvider, AIGenerateRequest, AIGenerateResult } from "./provider";
