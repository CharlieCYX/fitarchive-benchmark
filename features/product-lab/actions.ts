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
  postmortemSchema,
  prdSchema,
  productBriefEditSchema,
  productBriefSchema,
  prototypeTestSchema,
  releaseSchema,
} from "@/lib/validation/product-lab";

/**
 * Product Lab / PRD Studio actions (§9.5): brief → PRD (competitor matrix,
 * stories, FRs/NFRs, MVP boundary with deliberately-deferred list, success
 * metrics + instrumentation plan) → prototype tests → feature build record
 * → postmortem ("what should not be built").
 */

function back(id: string) {
  return `/studio/product-lab/${id}`;
}

export async function createProductBrief(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/product-lab", "error", ctx.error));

  const parsed = productBriefSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/product-lab", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/product-lab", "error", "No organization row found."));

  const { data, error } = await ctx.supabase
    .from("product_briefs")
    .insert({ org_id: orgId, ...parsed.data })
    .select("id")
    .single();
  if (error || !data) {
    redirect(withMessage("/studio/product-lab", "error", error?.message ?? "Create failed."));
  }
  revalidatePath("/studio/product-lab");
  redirect(withMessage(back(data.id as string), "notice", "Problem brief created."));
}

export async function saveProductBrief(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/product-lab", "error", ctx.error));

  const parsed = productBriefEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/product-lab", "error", zodMessage(parsed.error)));
  }
  const { product_brief_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("product_briefs")
    .update(fields)
    .eq("id", product_brief_id);
  revalidatePath(back(product_brief_id));
  redirect(
    error
      ? withMessage(back(product_brief_id), "error", error.message)
      : withMessage(back(product_brief_id), "notice", "Brief saved."),
  );
}

/** Create or replace the PRD for a brief (§9.5). Success metrics + instrumentation plan come BEFORE coding. */
export async function savePrd(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/product-lab", "error", ctx.error));

  const parsed = prdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/product-lab", "error", zodMessage(parsed.error)));
  }
  const { product_brief_id, ...fields } = parsed.data;
  const payload = {
    product_brief_id,
    competitor_matrix: fields.competitor_matrix ?? {},
    user_stories: fields.user_stories ?? [],
    functional_requirements: fields.functional_requirements ?? [],
    nonfunctional_requirements: fields.nonfunctional_requirements ?? [],
    mvp_scope: fields.mvp_scope,
    deferred_features: fields.deferred_features,
    success_metrics: fields.success_metrics ?? [],
    instrumentation_plan: fields.instrumentation_plan,
  };

  const { data: existing } = await ctx.supabase
    .from("prds")
    .select("id")
    .eq("product_brief_id", product_brief_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { error } = existing
    ? await ctx.supabase.from("prds").update(payload).eq("id", existing.id as string)
    : await ctx.supabase.from("prds").insert(payload);
  revalidatePath(back(product_brief_id));
  redirect(
    error
      ? withMessage(back(product_brief_id), "error", error.message)
      : withMessage(back(product_brief_id), "notice", "PRD saved — the deferred list is part of the MVP boundary."),
  );
}

/** Record a prototype test observation (§9.5). */
export async function addPrototypeTest(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/product-lab", "error", ctx.error));

  const parsed = prototypeTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/product-lab", "error", zodMessage(parsed.error)));
  }
  const { product_brief_id, prd_id, tested_at, ...fields } = parsed.data;
  const { error } = await ctx.supabase.from("prototype_tests").insert({
    prd_id,
    ...fields,
    tested_at: tested_at ? new Date(tested_at).toISOString() : null,
  });
  revalidatePath(back(product_brief_id));
  redirect(
    error
      ? withMessage(back(product_brief_id), "error", error.message)
      : withMessage(back(product_brief_id), "notice", "Prototype test recorded."),
  );
}

/** Append a release to the feature build record (§9.5) — append-only history. */
export async function addRelease(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/product-lab", "error", ctx.error));

  const parsed = releaseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/product-lab", "error", zodMessage(parsed.error)));
  }
  const { prd_id, product_brief_id, version, released_at, summary, feedback } = parsed.data;

  const { data: prd } = await ctx.supabase
    .from("prds")
    .select("releases")
    .eq("id", prd_id)
    .maybeSingle();
  if (!prd) redirect(withMessage(back(product_brief_id), "error", "PRD not found."));

  const releases = [
    ...(((prd as Record<string, unknown>).releases as unknown[] | null) ?? []),
    {
      version,
      released_at: released_at ? new Date(released_at).toISOString() : null,
      summary,
      feedback,
    },
  ];
  const { error } = await ctx.supabase.from("prds").update({ releases }).eq("id", prd_id);
  revalidatePath(back(product_brief_id));
  redirect(
    error
      ? withMessage(back(product_brief_id), "error", error.message)
      : withMessage(back(product_brief_id), "notice", `Release ${version} recorded.`),
  );
}

/** Postmortem — must name what should NOT be built (§9.5). */
export async function savePostmortem(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/product-lab", "error", ctx.error));

  const parsed = postmortemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/product-lab", "error", zodMessage(parsed.error)));
  }
  const { prd_id, product_brief_id, postmortem } = parsed.data;
  const { error } = await ctx.supabase.from("prds").update({ postmortem }).eq("id", prd_id);
  revalidatePath(back(product_brief_id));
  redirect(
    error
      ? withMessage(back(product_brief_id), "error", error.message)
      : withMessage(back(product_brief_id), "notice", "Postmortem saved."),
  );
}
