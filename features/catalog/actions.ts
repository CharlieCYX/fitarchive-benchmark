"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireOwnerContext,
  withMessage,
  zodMessage,
} from "@/lib/db/action-context";
import {
  availabilityTransitionSchema,
  deleteMeasurementSchema,
  measurementSchema,
  ownershipRecordSchema,
  productAssetSchema,
  productEditSchema,
} from "@/lib/validation/catalog";
import { getOrgId } from "@/lib/db/org";
import {
  setProductPublication,
  transitionAvailability,
  updateProduct,
} from "./service";

function back(productId: string) {
  return `/studio/catalog/${productId}`;
}

export async function saveProduct(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/catalog", "error", ctx.error));

  const parsed = productEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/catalog", "error", zodMessage(parsed.error)));
  }
  const result = await updateProduct(ctx.supabase, parsed.data);
  revalidatePath(back(parsed.data.product_id));
  redirect(
    result.ok
      ? withMessage(back(parsed.data.product_id), "notice", "Product saved.")
      : withMessage(back(parsed.data.product_id), "error", result.error ?? "Save failed."),
  );
}

/** Audited availability state-machine transition (§7.3). */
export async function changeAvailability(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/catalog", "error", ctx.error));

  const parsed = availabilityTransitionSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) {
    redirect(withMessage("/studio/catalog", "error", zodMessage(parsed.error)));
  }
  const result = await transitionAvailability(
    ctx.supabase,
    parsed.data.product_id,
    parsed.data.to,
  );
  revalidatePath(back(parsed.data.product_id));
  redirect(
    result.ok
      ? withMessage(back(parsed.data.product_id), "notice", `Availability → ${parsed.data.to}.`)
      : withMessage(back(parsed.data.product_id), "error", result.error ?? "Transition blocked."),
  );
}

/** Publish/unpublish (logged by the publication_change audit trigger). */
export async function toggleProductPublication(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/catalog", "error", ctx.error));

  const productId = String(formData.get("product_id") ?? "");
  const publish = formData.get("publish") === "true";
  const result = await setProductPublication(ctx.supabase, productId, publish);
  revalidatePath(back(productId));
  redirect(
    result.ok
      ? withMessage(back(productId), "notice", publish ? "Product published." : "Product unpublished.")
      : withMessage(back(productId), "error", result.error ?? "Publication change failed."),
  );
}

export async function addMeasurement(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/catalog", "error", ctx.error));

  const parsed = measurementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/catalog", "error", zodMessage(parsed.error)));
  }
  const { product_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("product_measurements")
    .upsert({ product_id, ...fields }, { onConflict: "product_id,name" });
  revalidatePath(back(product_id));
  redirect(
    error
      ? withMessage(back(product_id), "error", error.message)
      : withMessage(back(product_id), "notice", "Measurement saved."),
  );
}

export async function removeMeasurement(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/catalog", "error", ctx.error));

  const parsed = deleteMeasurementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/catalog", "error", zodMessage(parsed.error)));
  }
  const { error } = await ctx.supabase
    .from("product_measurements")
    .delete()
    .eq("id", parsed.data.measurement_id);
  revalidatePath(back(parsed.data.product_id));
  redirect(
    error
      ? withMessage(back(parsed.data.product_id), "error", error.message)
      : withMessage(back(parsed.data.product_id), "notice", "Measurement removed."),
  );
}

export async function addOwnershipRecord(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/catalog", "error", ctx.error));

  const parsed = ownershipRecordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/catalog", "error", zodMessage(parsed.error)));
  }
  const { product_id, state, note } = parsed.data;

  // Close the current record, then open the new one (§11.2 derived state).
  const now = new Date().toISOString();
  await ctx.supabase
    .from("ownership_records")
    .update({ effective_to: now })
    .eq("product_id", product_id)
    .is("effective_to", null);
  const { error } = await ctx.supabase.from("ownership_records").insert({
    product_id,
    state,
    effective_from: now,
    note,
  });
  revalidatePath(back(product_id));
  redirect(
    error
      ? withMessage(back(product_id), "error", error.message)
      : withMessage(back(product_id), "notice", `Ownership state → ${state}.`),
  );
}

export async function addAsset(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/catalog", "error", ctx.error));

  const parsed = productAssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/catalog", "error", zodMessage(parsed.error)));
  }
  const { product_id, ...fields } = parsed.data;
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage(back(product_id), "error", "No organization row found."));

  if (fields.synthetic && fields.provenance !== "ai_synthetic") {
    redirect(
      withMessage(
        back(product_id),
        "error",
        "Synthetic assets must carry provenance=ai_synthetic (DB check).",
      ),
    );
  }
  const { error } = await ctx.supabase
    .from("product_assets")
    .insert({ org_id: orgId, product_id, ...fields });
  revalidatePath(back(product_id));
  redirect(
    error
      ? withMessage(back(product_id), "error", error.message)
      : withMessage(back(product_id), "notice", "Asset recorded."),
  );
}
