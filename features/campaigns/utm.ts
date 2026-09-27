/**
 * Tracked-link builder (§7.6): every tracked link maps
 * campaign + channel + creative → UTM-tagged URL.
 * Pure module — unit-tested in tests/unit/utm.test.ts.
 */

export interface UtmInput {
  targetUrl: string;
  source: string; // utm_source — e.g. "instagram"
  medium: string; // utm_medium — e.g. "social"
  campaign: string; // utm_campaign — e.g. "drop-002"
  content?: string | null; // utm_content — creative variant
}

/** Slug-safe UTM value: lowercase, a-z0-9 and dashes only. */
export function slugifyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Append UTM params to a target URL. Returns null when the target is not a
 * valid absolute http(s) URL. Existing utm_* params on the target are
 * replaced (the tracked link is the source of truth).
 */
export function buildUtmUrl(input: UtmInput): string | null {
  let url: URL;
  try {
    url = new URL(input.targetUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.searchParams.set("utm_source", slugifyPart(input.source));
  url.searchParams.set("utm_medium", slugifyPart(input.medium));
  url.searchParams.set("utm_campaign", slugifyPart(input.campaign));
  const content = input.content ? slugifyPart(input.content) : "";
  if (content) url.searchParams.set("utm_content", content);
  else url.searchParams.delete("utm_content");
  return url.toString();
}

/**
 * Short unique-ish redirect code for tracked_links.code
 * (campaign + channel + creative). Deterministic so re-generating the same
 * combination surfaces the DB unique constraint instead of silent dupes.
 */
export function buildLinkCode(parts: {
  campaign: string;
  channel: string;
  content?: string | null;
}): string {
  const base = [parts.campaign, parts.channel, parts.content ?? ""]
    .map((p) => slugifyPart(p))
    .filter(Boolean)
    .join("-");
  return base.slice(0, 80);
}
