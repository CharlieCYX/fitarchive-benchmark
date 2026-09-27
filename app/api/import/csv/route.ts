import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { getOrgId } from "@/lib/db/org";
import { createRateLimiter } from "@/lib/rate-limit";
import { validateResearchCsv } from "@/lib/integrations/csv";
import { normalizeSourceUrl } from "@/features/research/urls";

export const dynamic = "force-dynamic";

/**
 * POST /api/import/csv — validated batch import of research listings
 * (API map §23.2; CSV schema §23.3).
 *
 * Body: { "csv": "<csv text>" } OR multipart form with a `file` field.
 * Every row is validated against the §23.3 schema independently; valid rows
 * insert as source_listings (platform resolved by name), invalid rows are
 * reported with per-field errors and never partially inserted. Duplicate
 * source URLs are skipped, not duplicated (unique org_id+normalized_url).
 */
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

async function readCsvText(request: NextRequest): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (file instanceof File) return file.text();
    const csv = form.get("csv");
    return typeof csv === "string" ? csv : null;
  }
  try {
    const body = (await request.json()) as { csv?: unknown };
    return typeof body.csv === "string" ? body.csv : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const rate = limiter.check(clientIp(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured — CSV import needs live credentials." },
      { status: 503 },
    );
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  if (user.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Owner role required for CSV import." }, { status: 403 });
  }

  const csvText = await readCsvText(request);
  if (!csvText) {
    return NextResponse.json(
      { ok: false, error: "Provide CSV text as { \"csv\": \"...\" } or a multipart `file` field." },
      { status: 400 },
    );
  }
  if (csvText.length > 1_000_000) {
    return NextResponse.json({ ok: false, error: "CSV too large (1 MB limit)." }, { status: 413 });
  }

  const validation = validateResearchCsv(csvText);
  if (validation.headerError) {
    return NextResponse.json(
      { ok: false, error: validation.headerError },
      { status: 400 },
    );
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }
  const orgId = await getOrgId(supabase);
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "No organization row found." }, { status: 500 });
  }

  const { data: platforms } = await supabase.from("source_platforms").select("id, name");
  const platformByName = new Map(
    ((platforms ?? []) as Array<{ id: string; name: string }>).map((p) => [
      p.name.toLowerCase(),
      p.id,
    ]),
  );

  let inserted = 0;
  let skippedDuplicates = 0;
  const rowErrors: Array<{ row: number; errors: string[] }> = validation.invalid
    .filter((e) => e.row > 0)
    .map((e) => ({ row: e.row, errors: e.errors }));

  for (const [i, row] of validation.valid.entries()) {
    const platformId = platformByName.get(row.source_platform.toLowerCase());
    if (!platformId) {
      rowErrors.push({
        row: i + 1,
        errors: [
          `Unknown source_platform "${row.source_platform}". Known: ${[...platformByName.keys()].join(", ")}.`,
        ],
      });
      continue;
    }
    const { error } = await supabase.from("source_listings").insert({
      org_id: orgId,
      source_platform_id: platformId,
      source_url: row.source_url ?? null,
      normalized_url: normalizeSourceUrl(row.source_url ?? null),
      captured_at: row.captured_at ? new Date(row.captured_at).toISOString() : new Date().toISOString(),
      seller_handle: row.seller_handle ?? null,
      title: row.title,
      brand: row.brand ?? null,
      asking_price_sgd: row.asking_price_sgd ?? null,
      condition_note: row.condition ?? null,
      visible_engagement: row.visible_engagement ?? null,
      listing_age_days: row.listing_age_days ?? null,
      permission_state: row.permission_state ?? "observed_only",
      drop_candidate: row.drop_candidate ?? false,
      notes: row.notes ?? null,
    });
    if (error) {
      if (error.message.includes("duplicate") || error.code === "23505") {
        skippedDuplicates++;
      } else {
        rowErrors.push({ row: i + 1, errors: [error.message] });
      }
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    ok: rowErrors.length === 0,
    inserted,
    skipped_duplicates: skippedDuplicates,
    rejected: rowErrors.length,
    row_errors: rowErrors.slice(0, 50),
    schema: "§23.3: source_platform, source_url, captured_at, seller_handle, title, brand, category, aesthetic, color, material, asking_price_sgd, condition, visible_engagement, listing_age_days, permission_state, drop_candidate, notes",
  });
}
