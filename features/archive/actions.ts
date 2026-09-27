"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getServiceRoleClient } from "@/lib/db/admin";
import { getOrgId } from "@/lib/db/org";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessArchive } from "@/lib/auth/roles";
import { withMessage, zodMessage } from "@/lib/db/action-context";
import {
  ANON_SESSION_COOKIE,
  ANON_SESSION_MAX_AGE_SEC,
  recordEvent,
} from "@/features/analytics/service";
import {
  closetItemSchema,
  collectionSchema,
  styleReferenceSchema,
} from "@/lib/validation/style";

/**
 * Shopper Archive mutations (§8.2). Every action requires a signed-in
 * non-viewer profile and touches only that profile's rows — RLS is the
 * enforcement layer; the guard is the friendly layer. Failures redirect
 * with an honest banner message, never a crash.
 */

type ShopperContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof getServerClient>> & object; profileId: string }
  | { ok: false; error: string };

async function requireShopperContext(): Promise<ShopperContext> {
  const supabase = await getServerClient();
  if (!supabase || !isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured — the Archive activates once it is." };
  }
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to use your Archive." };
  if (!canAccessArchive(user.role)) {
    return { ok: false, error: "Your role does not include an Archive." };
  }
  return { ok: true, supabase, profileId: user.id };
}

function fail(path: string, message: string): never {
  redirect(withMessage(path, "error", message));
}

/** Best-effort closet_item_add event (EVENTS_AND_METRICS §1). */
async function trackClosetItemAdd(profileId: string, closetItemId: string): Promise<void> {
  try {
    const service = getServiceRoleClient();
    const orgId = await getOrgId(service);
    if (!orgId) return;
    const jar = await cookies();
    const existing = jar.get(ANON_SESSION_COOKIE)?.value;
    const anonId = existing ?? crypto.randomUUID();
    if (!existing) {
      jar.set(ANON_SESSION_COOKIE, anonId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: ANON_SESSION_MAX_AGE_SEC,
        path: "/",
      });
    }
    await recordEvent(
      service,
      orgId,
      {
        event_name: "closet_item_add",
        client_event_id: crypto.randomUUID(),
        occurred_at: new Date().toISOString(),
        route: "/archive",
        referrer: null,
        properties: { closet_item_id: closetItemId },
      },
      { anonId, profileId, userAgent: null },
    );
  } catch {
    // Event tracking is best-effort; the write already succeeded.
  }
}

/* ------------------------------ closet items ----------------------------- */

export async function addClosetItem(formData: FormData): Promise<void> {
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail("/archive", ctx.error);

  const parsed = closetItemSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category") || null,
    color: formData.get("color") ?? "",
    fit_notes: formData.get("fit_notes") ?? "",
    wear_frequency: formData.get("wear_frequency") || null,
    ownership_source: formData.get("ownership_source") ?? "owned",
  });
  if (!parsed.success) fail("/archive", zodMessage(parsed.error));

  let categoryId: string | null = null;
  if (parsed.data.category) {
    const { data: tag } = await ctx.supabase
      .from("tags")
      .select("id")
      .eq("dimension", "category")
      .eq("slug", parsed.data.category)
      .eq("is_active", true)
      .maybeSingle();
    categoryId = (tag?.id as string | undefined) ?? null;
  }

  const { data, error } = await ctx.supabase
    .from("closet_items")
    .insert({
      profile_id: ctx.profileId,
      title: parsed.data.title,
      category_id: categoryId,
      color: parsed.data.color || null,
      fit_notes: parsed.data.fit_notes || null,
      wear_frequency: parsed.data.wear_frequency,
      ownership_source: parsed.data.ownership_source,
    })
    .select("id")
    .single();
  if (error || !data) fail("/archive", error?.message ?? "Could not add the item.");

  await trackClosetItemAdd(ctx.profileId, data.id as string);
  revalidatePath("/archive");
  redirect(withMessage("/archive", "notice", `"${parsed.data.title}" added to your closet.`));
}

export async function deleteClosetItem(formData: FormData): Promise<void> {
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail("/archive", ctx.error);
  const id = String(formData.get("closet_item_id") ?? "");
  const { error } = await ctx.supabase
    .from("closet_items")
    .delete()
    .eq("id", id)
    .eq("profile_id", ctx.profileId);
  revalidatePath("/archive");
  redirect(
    error
      ? withMessage("/archive", "error", error.message)
      : withMessage("/archive", "notice", "Closet item removed."),
  );
}

/* ------------------------------ collections ------------------------------ */

export async function createCollection(formData: FormData): Promise<void> {
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail("/archive", ctx.error);
  const parsed = collectionSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) fail("/archive", zodMessage(parsed.error));

  const { data, error } = await ctx.supabase
    .from("collections")
    .insert({
      profile_id: ctx.profileId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      is_public: false, // private by default (§8.2)
    })
    .select("id")
    .single();
  if (error || !data) fail("/archive", error?.message ?? "Could not create the collection.");
  revalidatePath("/archive");
  redirect(withMessage(`/archive/collections/${data.id as string}`, "notice", "Collection created — private until you share it."));
}

/** Explicit share toggle (§8.2/§15.2: private by default). */
export async function toggleCollectionPublic(formData: FormData): Promise<void> {
  const id = String(formData.get("collection_id") ?? "");
  const back = `/archive/collections/${id}`;
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail(back, ctx.error);

  const { data: current } = await ctx.supabase
    .from("collections")
    .select("is_public")
    .eq("id", id)
    .eq("profile_id", ctx.profileId)
    .maybeSingle();
  if (!current) fail(back, "Collection not found (or not yours).");

  const next = !(current.is_public as boolean);
  const { error } = await ctx.supabase
    .from("collections")
    .update({ is_public: next })
    .eq("id", id)
    .eq("profile_id", ctx.profileId);
  revalidatePath(back);
  redirect(
    error
      ? withMessage(back, "error", error.message)
      : withMessage(
          back,
          "notice",
          next
            ? "Collection is now public — anyone with the link can view it."
            : "Collection is private again.",
        ),
  );
}

export async function removeCollectionItem(formData: FormData): Promise<void> {
  const collectionId = String(formData.get("collection_id") ?? "");
  const back = `/archive/collections/${collectionId}`;
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail(back, ctx.error);
  const itemId = String(formData.get("collection_item_id") ?? "");
  const { error } = await ctx.supabase
    .from("collection_items")
    .delete()
    .eq("id", itemId)
    .eq("collection_id", collectionId);
  revalidatePath(back);
  redirect(
    error
      ? withMessage(back, "error", error.message)
      : withMessage(back, "notice", "Removed from collection."),
  );
}

/** Add one of the owner's favorites / references to a collection. */
export async function addCollectionItem(formData: FormData): Promise<void> {
  const collectionId = String(formData.get("collection_id") ?? "");
  const back = `/archive/collections/${collectionId}`;
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail(back, ctx.error);

  const productId = String(formData.get("product_id") ?? "") || null;
  const referenceId = String(formData.get("style_reference_id") ?? "") || null;
  if (!productId && !referenceId) fail(back, "Pick a product or a reference to add.");
  const note = String(formData.get("note") ?? "").slice(0, 500) || null;

  const { count } = await ctx.supabase
    .from("collection_items")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", collectionId);

  const { error } = await ctx.supabase.from("collection_items").insert({
    collection_id: collectionId,
    product_id: productId,
    style_reference_id: referenceId,
    note,
    position: (count ?? 0) + 1,
  });
  revalidatePath(back);
  redirect(
    error
      ? withMessage(back, "error", error.message)
      : withMessage(back, "notice", "Added to collection."),
  );
}

/* ------------------------------ references ------------------------------- */

/** Save a reference (URL or upload-path) with decoded attributes (§8.5). */
export async function addStyleReference(formData: FormData): Promise<void> {
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail("/archive", ctx.error);

  const rawAttributes = String(formData.get("attributes") ?? "");
  const attributes = rawAttributes
    .split(/[\n,]+/)
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [dimension, value] = pair.split(":").map((s) => s.trim());
      return { dimension, value };
    });

  const parsed = styleReferenceSchema.safeParse({
    source: formData.get("source") ?? "url",
    url: formData.get("url") ?? "",
    note: formData.get("note") ?? "",
    attributes,
  });
  if (!parsed.success) fail("/archive", zodMessage(parsed.error));
  if (parsed.data.source === "url" && !parsed.data.url) {
    fail("/archive", "A URL reference needs a URL.");
  }

  const { data, error } = await ctx.supabase
    .from("style_references")
    .insert({
      profile_id: ctx.profileId,
      source: parsed.data.source,
      url: parsed.data.url || null,
      note: parsed.data.note || null,
    })
    .select("id")
    .single();
  if (error || !data) fail("/archive", error?.message ?? "Could not save the reference.");

  // Decoded attributes: resolve tag ids where the slug exists; keep the
  // free_value otherwise so nothing the shopper decoded is lost (§11.4).
  for (const attr of parsed.data.attributes) {
    const { data: tag } = await ctx.supabase
      .from("tags")
      .select("id")
      .eq("dimension", attr.dimension)
      .eq("slug", attr.value)
      .eq("is_active", true)
      .maybeSingle();
    await ctx.supabase.from("style_reference_attributes").insert({
      style_reference_id: data.id as string,
      dimension: attr.dimension,
      tag_id: (tag?.id as string | undefined) ?? null,
      free_value: tag ? null : attr.value,
      source: "human",
    });
  }

  revalidatePath("/archive");
  redirect(withMessage("/archive", "notice", "Reference saved with its decoded attributes."));
}

export async function deleteStyleReference(formData: FormData): Promise<void> {
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail("/archive", ctx.error);
  const id = String(formData.get("style_reference_id") ?? "");
  const { error } = await ctx.supabase
    .from("style_references")
    .delete()
    .eq("id", id)
    .eq("profile_id", ctx.profileId);
  revalidatePath("/archive");
  redirect(
    error
      ? withMessage("/archive", "error", error.message)
      : withMessage("/archive", "notice", "Reference removed."),
  );
}

/* ------------------------------- favorites ------------------------------- */

export async function removeFavorite(formData: FormData): Promise<void> {
  const ctx = await requireShopperContext();
  if (!ctx.ok) fail("/archive", ctx.error);
  const favoriteId = String(formData.get("favorite_id") ?? "");
  const { error } = await ctx.supabase
    .from("favorites")
    .delete()
    .eq("id", favoriteId)
    .eq("profile_id", ctx.profileId);
  revalidatePath("/archive");
  redirect(
    error
      ? withMessage("/archive", "error", error.message)
      : withMessage("/archive", "notice", "Removed from saved products."),
  );
}
