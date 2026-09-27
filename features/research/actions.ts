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
  addObservationSchema,
  promoteListingSchema,
  sourceListingSchema,
} from "@/lib/validation/research";
import {
  addObservation,
  createListing,
  promoteListing,
} from "./service";

/** Quick-capture a source listing (§7.2). Duplicate URLs bounce to the existing record. */
export async function captureListing(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/research", "error", ctx.error));

  const parsed = sourceListingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(
      withMessage("/studio/research", "error", zodMessage(parsed.error)),
    );
  }

  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/research", "error", "No organization row found."));

  const categoryTagId = String(formData.get("category_tag_id") ?? "") || null;
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const result = await createListing(ctx.supabase, orgId, parsed.data, {
    categoryTagId,
    tags,
    actorId: ctx.user.id,
  });

  if (!result.ok) {
    redirect(withMessage("/studio/research", "error", result.error));
  }
  if (result.duplicate) {
    redirect(
      withMessage(
        `/studio/research/${result.id}`,
        "notice",
        "Duplicate detected — this normalized URL was already captured. Showing the existing record.",
      ),
    );
  }
  const tagNote =
    result.unmatchedTags.length > 0
      ? ` Tags not in taxonomy (skipped): ${result.unmatchedTags.join(", ")}.`
      : "";
  redirect(
    withMessage(
      `/studio/research/${result.id}`,
      "notice",
      `Listing captured.${tagNote}`,
    ),
  );
}

export async function recordObservation(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/research", "error", ctx.error));

  const parsed = addObservationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/research", "error", zodMessage(parsed.error)));
  }
  const back = `/studio/research/${parsed.data.listing_id}`;
  const result = await addObservation(
    ctx.supabase,
    parsed.data.listing_id,
    parsed.data.note,
    parsed.data.confidence ?? null,
    ctx.user.id,
  );
  revalidatePath(back);
  redirect(
    result.ok
      ? withMessage(back, "notice", "Observation recorded.")
      : withMessage(back, "error", result.error ?? "Failed to record observation."),
  );
}

/** Promote a listing to a draft product (§7.2 → §7.3). */
export async function promoteToProduct(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/research", "error", ctx.error));

  const parsed = promoteListingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/research", "error", zodMessage(parsed.error)));
  }
  const back = `/studio/research/${parsed.data.listing_id}`;
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage(back, "error", "No organization row found."));

  const result = await promoteListing(ctx.supabase, orgId, parsed.data.listing_id);
  if (!result.ok) redirect(withMessage(back, "error", result.error ?? "Promote failed."));
  revalidatePath("/studio/catalog");
  redirect(
    withMessage(
      `/studio/catalog/${result.productId}`,
      "notice",
      "Promoted to a draft product — complete condition, measurements and description in the Catalog.",
    ),
  );
}
