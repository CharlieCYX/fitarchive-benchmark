"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireOwnerContext,
  withMessage,
  zodMessage,
} from "@/lib/db/action-context";
import { getOrgId } from "@/lib/db/org";
import {
  cloneDropSchema,
  dropEditSchema,
  dropHypothesisSchema,
  dropItemRemoveSchema,
  dropItemSchema,
  dropItemUpdateSchema,
  dropPublishSchema,
  dropSchema,
} from "@/lib/validation/drops";
import { cloneDrop, publishDrop } from "./service";

function back(dropId: string) {
  return `/studio/drops/${dropId}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function createDrop(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = dropSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/drops", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/drops", "error", "No organization row found."));

  const slug = `${slugify(parsed.data.name)}-${Date.now().toString(36)}`;
  const { data, error } = await ctx.supabase
    .from("drops")
    .insert({ org_id: orgId, slug, status: "planning", ...parsed.data })
    .select("id")
    .single();
  if (error || !data) {
    redirect(withMessage("/studio/drops", "error", error?.message ?? "Create failed."));
  }
  revalidatePath("/studio/drops");
  redirect(withMessage(back(data.id as string), "notice", "Drop created — build the assortment."));
}

export async function saveDrop(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = dropEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/drops", "error", zodMessage(parsed.error)));
  }
  const { drop_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("drops")
    .update({
      ...fields,
      launch_at: fields.launch_at ? new Date(fields.launch_at).toISOString() : null,
    })
    .eq("id", drop_id);
  revalidatePath(back(drop_id));
  redirect(
    error
      ? withMessage(back(drop_id), "error", error.message)
      : withMessage(back(drop_id), "notice", "Drop saved."),
  );
}

export async function addItem(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = dropItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/drops", "error", zodMessage(parsed.error)));
  }
  const { drop_id, product_id, tier, price_override_sgd } = parsed.data;

  const { data: maxRow } = await ctx.supabase
    .from("drop_items")
    .select("position")
    .eq("drop_id", drop_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((maxRow?.position as number | undefined) ?? -1) + 1;

  const { error } = await ctx.supabase.from("drop_items").insert({
    drop_id,
    product_id,
    tier,
    price_override_sgd,
    position,
  });
  revalidatePath(back(drop_id));
  redirect(
    error
      ? withMessage(back(drop_id), "error", error.message)
      : withMessage(back(drop_id), "notice", "Item added."),
  );
}

export async function updateItem(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = dropItemUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/drops", "error", zodMessage(parsed.error)));
  }
  const { drop_item_id, drop_id, tier, direction, price_override_sgd } = parsed.data;

  if (direction) {
    // Swap positions with the neighbour in the given direction.
    const { data: rows } = await ctx.supabase
      .from("drop_items")
      .select("id, position")
      .eq("drop_id", drop_id)
      .order("position", { ascending: true });
    const list = (rows ?? []) as Array<{ id: string; position: number }>;
    const index = list.findIndex((r) => r.id === drop_item_id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index >= 0 && swapIndex >= 0 && swapIndex < list.length) {
      const a = list[index];
      const b = list[swapIndex];
      // Two-step via a temporary position avoids transient unique clashes.
      await ctx.supabase.from("drop_items").update({ position: -1 }).eq("id", a.id);
      await ctx.supabase.from("drop_items").update({ position: a.position }).eq("id", b.id);
      await ctx.supabase.from("drop_items").update({ position: b.position }).eq("id", a.id);
    }
  } else {
    const { error } = await ctx.supabase
      .from("drop_items")
      .update({ ...(tier ? { tier } : {}), price_override_sgd })
      .eq("id", drop_item_id);
    if (error) redirect(withMessage(back(drop_id), "error", error.message));
  }
  revalidatePath(back(drop_id));
  redirect(withMessage(back(drop_id), "notice", "Item updated."));
}

export async function removeItem(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = dropItemRemoveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/drops", "error", zodMessage(parsed.error)));
  }
  const { error } = await ctx.supabase
    .from("drop_items")
    .delete()
    .eq("id", parsed.data.drop_item_id);
  revalidatePath(back(parsed.data.drop_id));
  redirect(
    error
      ? withMessage(back(parsed.data.drop_id), "error", error.message)
      : withMessage(back(parsed.data.drop_id), "notice", "Item removed."),
  );
}

export async function addHypothesis(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = dropHypothesisSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/drops", "error", zodMessage(parsed.error)));
  }
  const { drop_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("drop_hypotheses")
    .insert({ drop_id, ...fields });
  revalidatePath(back(drop_id));
  redirect(
    error
      ? withMessage(back(drop_id), "error", error.message)
      : withMessage(back(drop_id), "notice", "Hypothesis recorded."),
  );
}

/** Publish through the §10.2 readiness gate; BLOCKS with reasons on failure. */
export async function publishDropAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = dropPublishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const dropId = String(formData.get("drop_id") ?? "");
    redirect(withMessage(back(dropId), "error", zodMessage(parsed.error)));
  }
  const dropId = parsed.data.drop_id;
  const result = await publishDrop(ctx.supabase, dropId, {
    personas: true,
    rollback: true,
  });
  revalidatePath(back(dropId));
  revalidatePath("/studio/drops");
  if (!result.ok) {
    const reasons = (result.failures ?? []).slice(0, 4).join(" | ");
    redirect(
      withMessage(
        back(dropId),
        "error",
        `${result.error}${reasons ? ` ${reasons}` : ""}`,
      ),
    );
  }
  redirect(withMessage(back(dropId), "notice", "Drop published. Readiness gate passed."));
}

/** Unpublish / move a published drop back to planning (rollback path §7.7). */
export async function unpublishDrop(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const dropId = String(formData.get("drop_id") ?? "");
  const { error } = await ctx.supabase
    .from("drops")
    .update({ status: "paused", published_at: null })
    .eq("id", dropId)
    .eq("status", "published");
  revalidatePath(back(dropId));
  redirect(
    error
      ? withMessage(back(dropId), "error", error.message)
      : withMessage(back(dropId), "notice", "Drop paused and unpublished (rollback)."),
  );
}

/** Clone Drop #N → #N+1, preserving cloned_from_id comparison link (§7.5). */
export async function cloneDropAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/drops", "error", ctx.error));

  const parsed = cloneDropSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/drops", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/drops", "error", "No organization row found."));

  const result = await cloneDrop(ctx.supabase, orgId, parsed.data.drop_id);
  revalidatePath("/studio/drops");
  if (!result.ok) {
    redirect(withMessage(back(parsed.data.drop_id), "error", result.error ?? "Clone failed."));
  }
  redirect(
    withMessage(
      back(result.newDropId as string),
      "notice",
      "Cloned — concept, story, targets and hypotheses carried over. Assortment starts empty; comparison link preserved.",
    ),
  );
}
