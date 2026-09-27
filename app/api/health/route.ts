import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — build metadata (ARCHITECTURE.md §6, Build Bible §17.2).
 * Commit hash + build time are injected at build time via next.config.ts
 * (COMMIT_REF / GITHUB_SHA / VERCEL_GIT_COMMIT_SHA).
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "fitarchive-benchmark",
    commit: process.env.COMMIT_HASH || null,
    buildTime: process.env.BUILD_TIME || null,
    supabaseConfigured: isSupabaseConfigured(),
    time: new Date().toISOString(),
  });
}
