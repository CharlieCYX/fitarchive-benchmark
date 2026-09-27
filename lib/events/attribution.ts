/**
 * UTM / campaign attribution parsing (§12.1: page_view carries
 * campaign + utm_source/medium/campaign/content). Pure module — unit-tested
 * in tests/unit/attribution.test.ts. The client tracker reads these from the
 * current URL; tracked-link redirects (§7.6) set them.
 */

export interface Attribution {
  /** Mirrors utm_campaign — the dictionary's nullable `campaign` prop. */
  campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

type ParamsLike =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function read(params: ParamsLike, key: string): string | null {
  let raw: string | null;
  if (params instanceof URLSearchParams) {
    raw = params.get(key);
  } else {
    const value = params[key];
    raw = Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  }
  if (raw === null) return null;
  const trimmed = raw.trim().slice(0, 200);
  return trimmed === "" ? null : trimmed;
}

/** Extract attribution from query params; missing/empty values become null. */
export function parseAttribution(params: ParamsLike): Attribution {
  const utmCampaign = read(params, "utm_campaign");
  return {
    campaign: utmCampaign,
    utm_source: read(params, "utm_source"),
    utm_medium: read(params, "utm_medium"),
    utm_campaign: utmCampaign,
    utm_content: read(params, "utm_content"),
  };
}
