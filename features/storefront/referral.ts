import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { getServiceRoleClient } from "@/lib/db/admin";

/**
 * PDP referral target resolver (red-team H3). `source_listings` and
 * `tracked_links` are owner-only RLS tables, so the cookie-bound client can
 * never resolve a referral destination — for real shoppers the CTA used to
 * render "Referral listing" + "Not for sale". This server-side helper uses
 * the service role and returns ONLY { destination, trackedLinkId } — no
 * other source-listing fields ever leave the server.
 *
 * Returns null when unconfigured, when the product is unpublished, or when
 * either side of the referral pair is missing (the PDP then falls back to
 * the honest "not for sale" state instead of a dead CTA).
 */
export interface ReferralTarget {
  destination: string;
  trackedLinkId: string;
}

export async function getReferralTarget(product: {
  id: string;
  slug: string;
  source_listing_id: string | null;
  published_at: string | null;
}): Promise<ReferralTarget | null> {
  if (!product.published_at || !product.source_listing_id) return null;
  if (!isSupabaseConfigured()) return null;

  try {
    const service = getServiceRoleClient();
    const [sourceResult, linkResult] = await Promise.all([
      service
        .from("source_listings")
        .select("source_url")
        .eq("id", product.source_listing_id)
        .maybeSingle(),
      service
        .from("tracked_links")
        .select("id")
        .ilike("target_url", `%/products/${product.slug}%`)
        .limit(1)
        .maybeSingle(),
    ]);
    const destination = (sourceResult.data as { source_url?: string } | null)
      ?.source_url;
    const trackedLinkId = (linkResult.data as { id?: string } | null)?.id;
    if (!destination || !trackedLinkId) return null;
    // Only http(s) destinations ever reach the client.
    if (!/^https?:\/\//i.test(destination)) return null;
    return { destination, trackedLinkId };
  } catch {
    return null;
  }
}
