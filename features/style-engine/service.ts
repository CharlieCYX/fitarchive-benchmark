import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GarmentProfile, StyleMode } from "./types";

/**
 * Style Engine persistence + garment loading (server-only). Constraint
 * logic lives in the pure modules (build/compatibility/decode/rules); this
 * file only moves rows in and out of Supabase. Sessions belong to the
 * signed-in profile when present, otherwise to the pseudonymous session.
 */

/** Load published catalog products as garment profiles (with tag signals). */
export async function loadCatalogGarments(
  supabase: SupabaseClient,
): Promise<GarmentProfile[]> {
  const [productsRes, tagsRes, assignmentsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, title, public_price_sgd, availability, category_id")
      .not("published_at", "is", null),
    supabase.from("tags").select("id, dimension, slug"),
    supabase
      .from("tag_assignments")
      .select("entity_id, tag_id")
      .eq("entity_type", "product")
      .eq("accepted", true),
  ]);

  const tagById = new Map(
    ((tagsRes.data ?? []) as Array<{ id: string; dimension: string; slug: string }>).map(
      (t) => [t.id, t] as const,
    ),
  );
  const categorySlugById = new Map<string, string>();
  for (const tag of tagById.values()) {
    if (tag.dimension === "category") categorySlugById.set(tag.id, tag.slug);
  }

  const signalsByProduct = new Map<
    string,
    { silhouette: string[]; material: string[]; palette: string[]; energy: string[]; era: string[] }
  >();
  for (const row of (assignmentsRes.data ?? []) as Array<{ entity_id: string; tag_id: string }>) {
    const tag = tagById.get(row.tag_id);
    if (!tag) continue;
    const bucket =
      signalsByProduct.get(row.entity_id) ?? {
        silhouette: [],
        material: [],
        palette: [],
        energy: [],
        era: [],
      };
    if (tag.dimension === "silhouette") bucket.silhouette.push(tag.slug);
    else if (tag.dimension === "material") bucket.material.push(tag.slug);
    else if (tag.dimension === "palette_role") bucket.palette.push(tag.slug);
    else if (tag.dimension === "energy") bucket.energy.push(tag.slug);
    else if (tag.dimension === "era") bucket.era.push(tag.slug);
    else continue;
    signalsByProduct.set(row.entity_id, bucket);
  }

  return ((productsRes.data ?? []) as Array<{
    id: string;
    title: string;
    public_price_sgd: string | number | null;
    availability: string;
    category_id: string | null;
  }>).map((p) => {
    const signals = signalsByProduct.get(p.id) ?? {
      silhouette: [],
      material: [],
      palette: [],
      energy: [],
      era: [],
    };
    return {
      id: p.id,
      source: "catalog",
      label: p.title,
      category: p.category_id ? (categorySlugById.get(p.category_id) ?? null) : null,
      ...signals,
      priceSgd: p.public_price_sgd === null ? null : Number(p.public_price_sgd),
      availability: p.availability,
    };
  });
}

/** Load the signed-in shopper's closet as garment profiles (§8.2 private). */
export async function loadClosetGarments(
  supabase: SupabaseClient,
  profileId: string,
): Promise<GarmentProfile[]> {
  const { data } = await supabase
    .from("closet_items")
    .select("id, title, color, category_id, tags!closet_items_category_id_fkey(slug)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    id: string;
    title: string;
    color: string | null;
    tags: { slug: string } | { slug: string }[] | null;
  }>).map((row) => {
    const tag = Array.isArray(row.tags) ? row.tags[0] : row.tags;
    return {
      id: row.id,
      source: "closet",
      label: row.color ? `${row.title} (${row.color})` : row.title,
      category: tag?.slug ?? null,
      silhouette: [],
      material: [],
      palette: [],
      energy: [],
      era: [],
      priceSgd: null,
      availability: null,
    };
  });
}

export interface StyleSessionRecord {
  id: string;
  mode: StyleMode;
  deterministic: boolean;
  created_at: string;
}

/** Persist a style session (§8.7) and return its id. */
export async function persistStyleSession(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    profileId: string | null;
    sessionId: string | null;
    mode: StyleMode;
    inputs: Record<string, unknown>;
    result: Record<string, unknown>;
    deterministic: boolean;
    aiGenerationId: string | null;
  },
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("style_sessions")
    .insert({
      org_id: input.orgId,
      profile_id: input.profileId,
      session_id: input.sessionId,
      mode: input.mode,
      inputs: input.inputs,
      result: input.result,
      deterministic: input.deterministic,
      ai_generation_id: input.aiGenerationId,
    })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };
  return { id: (data?.id as string | undefined) ?? null, error: null };
}

/**
 * Update an existing session row with its result — only when the caller owns
 * it (profile match or same pseudonymous session). Used when the client
 * created the session via POST /api/style/sessions before generating.
 */
export async function finalizeStyleSession(
  supabase: SupabaseClient,
  input: {
    styleSessionId: string;
    profileId: string | null;
    sessionRowId: string | null;
    inputs: Record<string, unknown>;
    result: Record<string, unknown>;
    deterministic: boolean;
    aiGenerationId: string | null;
  },
): Promise<{ updated: boolean; error: string | null }> {
  const { data: row, error: readError } = await supabase
    .from("style_sessions")
    .select("id, profile_id, session_id")
    .eq("id", input.styleSessionId)
    .maybeSingle();
  if (readError) return { updated: false, error: readError.message };
  if (!row) return { updated: false, error: "Style session not found." };

  const ownsByProfile =
    input.profileId !== null && row.profile_id === input.profileId;
  const ownsBySession =
    input.sessionRowId !== null &&
    row.session_id === input.sessionRowId &&
    row.profile_id === null;
  if (!ownsByProfile && !ownsBySession) {
    return { updated: false, error: "This style session belongs to someone else." };
  }

  const { error } = await supabase
    .from("style_sessions")
    .update({
      inputs: input.inputs,
      result: input.result,
      deterministic: input.deterministic,
      ai_generation_id: input.aiGenerationId,
    })
    .eq("id", input.styleSessionId);
  return { updated: !error, error: error?.message ?? null };
}

/** Record §8.3 feedback with optional §8.8 failure-mode tag. */
export async function persistStyleFeedback(
  supabase: SupabaseClient,
  input: {
    styleSessionId: string;
    label: string;
    failureMode: string | null;
    note: string;
    createdBy: string | null;
  },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("style_feedback").insert({
    style_session_id: input.styleSessionId,
    label: input.label,
    failure_mode: input.failureMode,
    note: input.note || null,
    created_by: input.createdBy,
  });
  return { error: error?.message ?? null };
}

/** Sessions for the archive view (self or pseudonymous session). */
export async function listStyleSessionsForProfile(
  supabase: SupabaseClient,
  profileId: string,
): Promise<
  Array<{
    id: string;
    mode: string;
    deterministic: boolean;
    inputs: Record<string, unknown>;
    result: Record<string, unknown>;
    created_at: string;
  }>
> {
  const { data } = await supabase
    .from("style_sessions")
    .select("id, mode, deterministic, inputs, result, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{
    id: string;
    mode: string;
    deterministic: boolean;
    inputs: Record<string, unknown>;
    result: Record<string, unknown>;
    created_at: string;
  }>;
}
