import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/env";

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

describe("supabase env handling (graceful unconfigured mode)", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = { [URL_KEY]: process.env[URL_KEY], [ANON_KEY]: process.env[ANON_KEY] };
  });

  afterEach(() => {
    if (saved[URL_KEY] === undefined) delete process.env[URL_KEY];
    else process.env[URL_KEY] = saved[URL_KEY];
    if (saved[ANON_KEY] === undefined) delete process.env[ANON_KEY];
    else process.env[ANON_KEY] = saved[ANON_KEY];
  });

  it("reports unconfigured when vars are absent (no crash)", () => {
    delete process.env[URL_KEY];
    delete process.env[ANON_KEY];
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseEnv().url).toBeUndefined();
  });

  it("reports unconfigured when only one var is set", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    delete process.env[ANON_KEY];
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("reports configured when both vars are set", () => {
    process.env[URL_KEY] = "https://example.supabase.co";
    process.env[ANON_KEY] = "anon-key";
    const env = getSupabaseEnv();
    expect(env.configured).toBe(true);
    expect(env.url).toBe("https://example.supabase.co");
  });
});
