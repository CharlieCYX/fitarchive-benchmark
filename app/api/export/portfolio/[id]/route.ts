import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { assertNoPrivateFields, frozenPayloadSchema } from "@/features/portfolio/snapshot";

export const dynamic = "force-dynamic";

/**
 * GET /api/export/portfolio/:id — portfolio-safe JSON export (§23.2).
 *
 * `:id` accepts a snapshot id, a snapshot slug, or a portfolio_project id
 * (latest frozen snapshot of that project). The export is the FROZEN payload
 * only — never live operational tables — and is re-checked against the
 * §15.2 private-field guard before leaving the server.
 *
 * Access: owner can export any frozen snapshot; anyone may export a snapshot
 * that is_public (it is already the public case-study representation).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured — export needs live credentials." },
      { status: 503 },
    );
  }
  const { id } = await params;
  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Try snapshot by id or slug first.
  let snapshot: Record<string, unknown> | null = null;
  if (isUuid) {
    const { data } = await supabase
      .from("portfolio_snapshots")
      .select("id, slug, version, is_public, frozen_at, published_at, frozen_payload, portfolio_project_id")
      .eq("id", id)
      .maybeSingle();
    snapshot = (data as Record<string, unknown> | null) ?? null;
  }
  if (!snapshot) {
    const { data } = await supabase
      .from("portfolio_snapshots")
      .select("id, slug, version, is_public, frozen_at, published_at, frozen_payload, portfolio_project_id")
      .eq("slug", id)
      .maybeSingle();
    snapshot = (data as Record<string, unknown> | null) ?? null;
  }
  if (!snapshot && isUuid) {
    // Fall back: latest frozen snapshot of the project.
    const { data } = await supabase
      .from("portfolio_snapshots")
      .select("id, slug, version, is_public, frozen_at, published_at, frozen_payload, portfolio_project_id")
      .eq("portfolio_project_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    snapshot = (data as Record<string, unknown> | null) ?? null;
  }
  if (!snapshot) {
    return NextResponse.json({ ok: false, error: "No frozen snapshot found for that id/slug." }, { status: 404 });
  }

  if (!snapshot.is_public) {
    const user = await getSessionUser();
    if (!user || user.role !== "owner") {
      return NextResponse.json(
        { ok: false, error: "This snapshot is not public; owner sign-in required." },
        { status: user ? 403 : 401 },
      );
    }
  }

  const payloadParsed = frozenPayloadSchema.safeParse(snapshot.frozen_payload);
  if (!payloadParsed.success) {
    return NextResponse.json(
      { ok: false, error: "Stored snapshot payload failed the §21.2 schema; refusing to export." },
      { status: 500 },
    );
  }
  const privateHits = assertNoPrivateFields(payloadParsed.data);
  if (privateHits) {
    return NextResponse.json(
      { ok: false, error: `Private field(s) detected (${privateHits.join(", ")}); refusing to export (§15.2).` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    export_kind: "portfolio_snapshot",
    snapshot: {
      id: snapshot.id,
      slug: snapshot.slug,
      version: snapshot.version,
      is_public: snapshot.is_public,
      frozen_at: snapshot.frozen_at,
      published_at: snapshot.published_at,
      payload: payloadParsed.data,
    },
    note: "Portfolio-safe export: frozen §21.2 payload only. Buyer contacts, seller private notes, cost basis and internal financials are never included (§15.2).",
  });
}
