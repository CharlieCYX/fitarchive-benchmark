import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Campaign Studio service (§7.6) — server-only. Tracked links are built by
 * the pure features/campaigns/utm module; every asset carries provenance and
 * an approval state (AI output stays a suggestion until approved, §7.6).
 */

export interface CampaignListRow {
  id: string;
  name: string;
  status: string;
  drop_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  asset_count: number;
  pending_assets: number;
}

export async function listCampaigns(
  supabase: SupabaseClient,
): Promise<CampaignListRow[]> {
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, status, starts_at, ends_at, drops(name), campaign_assets(approval_status)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const assets =
      (row.campaign_assets as Array<{ approval_status: string }> | null) ?? [];
    return {
      id: row.id as string,
      name: row.name as string,
      status: row.status as string,
      drop_name: (row.drops as { name?: string } | null)?.name ?? null,
      starts_at: (row.starts_at as string | null) ?? null,
      ends_at: (row.ends_at as string | null) ?? null,
      asset_count: assets.length,
      pending_assets: assets.filter((a) => a.approval_status === "draft").length,
    };
  });
}

export interface CampaignDetail {
  campaign: {
    id: string;
    name: string;
    brief: string | null;
    status: string;
    drop_id: string | null;
    starts_at: string | null;
    ends_at: string | null;
  };
  dropName: string | null;
  dropSlug: string | null;
  assets: Array<{
    id: string;
    kind: string;
    asset_path: string | null;
    version: number;
    approval_status: string;
    ai_generation_id: string | null;
    synthetic_disclosed: boolean;
  }>;
  posts: Array<{
    id: string;
    channel: string;
    copy: string | null;
    planned_at: string | null;
    published_at: string | null;
    state: string;
  }>;
  links: Array<{
    id: string;
    target_url: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    channel: string;
    code: string;
  }>;
}

export async function getCampaignDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<CampaignDetail | null> {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, brief, status, drop_id, starts_at, ends_at, drops(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) return null;

  const [{ data: assets }, { data: posts }, { data: links }] = await Promise.all([
    supabase
      .from("campaign_assets")
      .select("id, kind, asset_path, version, approval_status, ai_generation_id, synthetic_disclosed")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("campaign_posts")
      .select("id, channel, copy, planned_at, published_at, state")
      .eq("campaign_id", id)
      .order("planned_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("tracked_links")
      .select("id, target_url, utm_source, utm_medium, utm_campaign, utm_content, channel, code")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const row = campaign as Record<string, unknown>;
  const dropJoin = row.drops as { name?: string; slug?: string } | null;
  return {
    campaign: campaign as CampaignDetail["campaign"],
    dropName: dropJoin?.name ?? null,
    dropSlug: dropJoin?.slug ?? null,
    assets: (assets ?? []) as CampaignDetail["assets"],
    posts: (posts ?? []) as CampaignDetail["posts"],
    links: (links ?? []) as CampaignDetail["links"],
  };
}

/** Full UTM URL for display, recomposed from the stored fields. */
export function trackedLinkDisplayUrl(link: {
  target_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}): string {
  try {
    const url = new URL(link.target_url);
    if (link.utm_source) url.searchParams.set("utm_source", link.utm_source);
    if (link.utm_medium) url.searchParams.set("utm_medium", link.utm_medium);
    if (link.utm_campaign) url.searchParams.set("utm_campaign", link.utm_campaign);
    if (link.utm_content) url.searchParams.set("utm_content", link.utm_content);
    return url.toString();
  } catch {
    return link.target_url;
  }
}
