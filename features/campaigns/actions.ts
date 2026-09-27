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
  campaignAssetApprovalSchema,
  campaignAssetSchema,
  campaignEditSchema,
  campaignPostSchema,
  campaignSchema,
  trackedLinkSchema,
} from "@/lib/validation/campaigns";
import { buildLinkCode, buildUtmUrl, slugifyPart } from "./utm";

function back(campaignId: string) {
  return `/studio/campaigns/${campaignId}`;
}

export async function createCampaign(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/campaigns", "error", ctx.error));

  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/campaigns", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/campaigns", "error", "No organization row found."));

  const { data, error } = await ctx.supabase
    .from("campaigns")
    .insert({
      org_id: orgId,
      ...parsed.data,
      starts_at: parsed.data.starts_at ? new Date(parsed.data.starts_at).toISOString() : null,
      ends_at: parsed.data.ends_at ? new Date(parsed.data.ends_at).toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    redirect(withMessage("/studio/campaigns", "error", error?.message ?? "Create failed."));
  }
  revalidatePath("/studio/campaigns");
  redirect(withMessage(back(data.id as string), "notice", "Campaign created."));
}

export async function saveCampaign(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/campaigns", "error", ctx.error));

  const parsed = campaignEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/campaigns", "error", zodMessage(parsed.error)));
  }
  const { campaign_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("campaigns")
    .update({
      ...fields,
      starts_at: fields.starts_at ? new Date(fields.starts_at).toISOString() : null,
      ends_at: fields.ends_at ? new Date(fields.ends_at).toISOString() : null,
    })
    .eq("id", campaign_id);
  revalidatePath(back(campaign_id));
  redirect(
    error
      ? withMessage(back(campaign_id), "error", error.message)
      : withMessage(back(campaign_id), "notice", "Campaign saved."),
  );
}

/** Add a moodboard/creative asset with provenance (§7.6). Draft until approved. */
export async function addAsset(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/campaigns", "error", ctx.error));

  const parsed = campaignAssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/campaigns", "error", zodMessage(parsed.error)));
  }
  const { campaign_id, provenance, ...fields } = parsed.data;
  const { error } = await ctx.supabase.from("campaign_assets").insert({
    campaign_id,
    ...fields,
    // AI provenance is recorded via ai_generation_id when the AI Lab (Phase 7)
    // is live; the provenance enum is carried in the path metadata for now.
    approval_status: "draft",
  });
  void provenance;
  revalidatePath(back(campaign_id));
  redirect(
    error
      ? withMessage(back(campaign_id), "error", error.message)
      : withMessage(back(campaign_id), "notice", "Asset added as draft — approve before use."),
  );
}

/** Approval workflow: draft → approved | rejected (§7.6). */
export async function decideAsset(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/campaigns", "error", ctx.error));

  const parsed = campaignAssetApprovalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/campaigns", "error", zodMessage(parsed.error)));
  }
  const { asset_id, campaign_id, decision } = parsed.data;
  const { error } = await ctx.supabase
    .from("campaign_assets")
    .update({ approval_status: decision })
    .eq("id", asset_id);
  revalidatePath(back(campaign_id));
  redirect(
    error
      ? withMessage(back(campaign_id), "error", error.message)
      : withMessage(back(campaign_id), "notice", `Asset ${decision}.`),
  );
}

/** Plan a post / copy variant on the content calendar. */
export async function addPost(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/campaigns", "error", ctx.error));

  const parsed = campaignPostSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/campaigns", "error", zodMessage(parsed.error)));
  }
  const { campaign_id, planned_at, ...fields } = parsed.data;
  const { error } = await ctx.supabase.from("campaign_posts").insert({
    campaign_id,
    ...fields,
    planned_at: planned_at ? new Date(planned_at).toISOString() : null,
  });
  revalidatePath(back(campaign_id));
  redirect(
    error
      ? withMessage(back(campaign_id), "error", error.message)
      : withMessage(back(campaign_id), "notice", "Post planned."),
  );
}

/**
 * Tracked-link generator (§7.6): campaign + channel + creative → UTM URL.
 * Every link maps back to the campaign; the UTM URL is validated by the pure
 * utm module before insert.
 */
export async function generateTrackedLink(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/campaigns", "error", ctx.error));

  const parsed = trackedLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/campaigns", "error", zodMessage(parsed.error)));
  }
  const { campaign_id, target_url, channel, utm_source, utm_medium, utm_content, campaign_post_id } =
    parsed.data;

  const { data: campaign } = await ctx.supabase
    .from("campaigns")
    .select("name")
    .eq("id", campaign_id)
    .maybeSingle();
  if (!campaign) redirect(withMessage(back(campaign_id), "error", "Campaign not found."));

  const utmCampaign = slugifyPart(campaign.name as string);
  const url = buildUtmUrl({
    targetUrl: target_url,
    source: utm_source,
    medium: utm_medium,
    campaign: utmCampaign,
    content: utm_content,
  });
  if (!url) {
    redirect(withMessage(back(campaign_id), "error", "Target URL is not a valid http(s) URL."));
  }

  const code = buildLinkCode({ campaign: utmCampaign, channel, content: utm_content });
  const { error } = await ctx.supabase.from("tracked_links").insert({
    campaign_id,
    campaign_post_id,
    target_url,
    utm_source: slugifyPart(utm_source),
    utm_medium: slugifyPart(utm_medium),
    utm_campaign: utmCampaign,
    utm_content: utm_content ? slugifyPart(utm_content) : null,
    channel,
    code,
  });
  revalidatePath(back(campaign_id));
  redirect(
    error
      ? withMessage(back(campaign_id), "error", error.message)
      : withMessage(back(campaign_id), "notice", `Tracked link created: ${url}`),
  );
}
