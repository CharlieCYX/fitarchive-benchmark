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
  agreementSchema,
  permissionRequestSchema,
  permissionTransitionSchema,
  sellerContactSchema,
  sellerSchema,
} from "@/lib/validation/sellers";
import { allowedPermissionTransitions } from "./permissions";
import type { PermissionState } from "./permissions";
import { revokePermission } from "./service";

export async function createSeller(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/sellers", "error", ctx.error));

  const parsed = sellerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/sellers", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/sellers", "error", "No organization row found."));

  const { data, error } = await ctx.supabase
    .from("sellers")
    .insert({ org_id: orgId, ...parsed.data })
    .select("id")
    .single();
  if (error || !data) {
    redirect(withMessage("/studio/sellers", "error", error?.message ?? "Create failed."));
  }
  revalidatePath("/studio/sellers");
  redirect(withMessage(`/studio/sellers/${data.id}`, "notice", "Seller created."));
}

export async function addContact(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/sellers", "error", ctx.error));

  const parsed = sellerContactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/sellers", "error", zodMessage(parsed.error)));
  }
  const { seller_id, ...fields } = parsed.data;
  const back = `/studio/sellers/${seller_id}`;
  const { error } = await ctx.supabase
    .from("seller_contacts")
    .insert({ seller_id, ...fields });
  revalidatePath(back);
  redirect(
    error
      ? withMessage(back, "error", error.message)
      : withMessage(back, "notice", "Contact added."),
  );
}

export async function requestPermission(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/sellers", "error", ctx.error));

  const parsed = permissionRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/sellers", "error", zodMessage(parsed.error)));
  }
  const { seller_id, ...fields } = parsed.data;
  const back = `/studio/sellers/${seller_id}`;
  const { error } = await ctx.supabase.from("permissions").insert({
    seller_id,
    ...fields,
    granted_at: fields.granted_at ? new Date(fields.granted_at).toISOString() : null,
    expires_at: fields.expires_at ? new Date(fields.expires_at).toISOString() : null,
  });
  revalidatePath(back);
  redirect(
    error
      ? withMessage(back, "error", error.message)
      : withMessage(back, "notice", "Permission ledger entry recorded."),
  );
}

/** Advance a permission along the §5.2 lifecycle (revoke is separate). */
export async function transitionPermission(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/sellers", "error", ctx.error));

  const parsed = permissionTransitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/sellers", "error", zodMessage(parsed.error)));
  }
  const { permission_id, seller_id, to } = parsed.data;
  const back = `/studio/sellers/${seller_id}`;

  if (to === "expired_revoked") {
    const result = await revokePermission(ctx.supabase, permission_id);
    revalidatePath(back);
    revalidatePath("/studio/catalog");
    if (!result.ok) {
      redirect(withMessage(back, "error", result.error ?? "Revocation failed."));
    }
    const note =
      result.unpublished.length > 0
        ? `Permission revoked. Unpublished: ${result.unpublished.join(", ")}.`
        : "Permission revoked. No published products were affected.";
    redirect(withMessage(back, "notice", note));
  }

  const { data: current } = await ctx.supabase
    .from("permissions")
    .select("state")
    .eq("id", permission_id)
    .maybeSingle();
  if (!current) redirect(withMessage(back, "error", "Permission not found."));

  const from = current.state as PermissionState;
  if (!allowedPermissionTransitions(from).includes(to)) {
    redirect(
      withMessage(back, "error", `Cannot move permission from ${from} to ${to} (§5.2 lifecycle).`),
    );
  }

  const { error } = await ctx.supabase
    .from("permissions")
    .update({
      state: to,
      granted_at: ["permission_referral", "permission_consignment", "owned", "borrowed_for_content", "prototype_permission"].includes(to)
        ? new Date().toISOString()
        : null,
    })
    .eq("id", permission_id);
  revalidatePath(back);
  redirect(
    error
      ? withMessage(back, "error", error.message)
      : withMessage(back, "notice", `Permission → ${to}.`),
  );
}

export async function createAgreement(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/sellers", "error", ctx.error));

  const parsed = agreementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/sellers", "error", zodMessage(parsed.error)));
  }
  const { seller_id, ...fields } = parsed.data;
  const back = `/studio/sellers/${seller_id}`;
  const { error } = await ctx.supabase.from("agreements").insert({
    seller_id,
    ...fields,
    ends_at: fields.ends_at ? new Date(fields.ends_at).toISOString() : null,
  });
  revalidatePath(back);
  redirect(
    error
      ? withMessage(back, "error", error.message)
      : withMessage(back, "notice", "Agreement recorded."),
  );
}
