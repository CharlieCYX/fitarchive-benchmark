import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatDate } from "@/lib/utils";
import {
  addAsset,
  addPost,
  decideAsset,
  generateTrackedLink,
  saveCampaign,
} from "@/features/campaigns/actions";
import { getCampaignDetail, trackedLinkDisplayUrl } from "@/features/campaigns/service";
import { CAMPAIGN_CHANNELS } from "@/lib/validation/campaigns";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Campaign detail" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Campaign Studio"
        spec="§7.6"
        summary="Campaign detail: brief, moodboard, calendar, tracked links, approvals."
      />
    );
  }

  const [{ id }, bannerParams] = await Promise.all([params, searchParams]);
  const [detail, { data: dropRows }] = await Promise.all([
    getCampaignDetail(supabase, id),
    supabase.from("drops").select("id, name").order("created_at", { ascending: false }),
  ]);
  if (!detail) notFound();
  const dropOptions = (dropRows ?? []) as Array<{ id: string; name: string }>;

  const { campaign } = detail;
  const moodboard = detail.assets.filter((a) => a.kind === "image");
  const copyAssets = detail.assets.filter((a) => a.kind === "copy");
  const postAssets = detail.assets.filter((a) => a.kind === "post");

  return (
    <div className="max-w-5xl">
      <Link href="/studio/campaigns" className="text-sm text-warm-500 hover:text-ink">
        ← Campaigns
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">{campaign.name}</h1>
        <Badge>{campaign.status}</Badge>
        {detail.dropName && campaign.drop_id ? (
          <span className="text-sm text-warm-500">
            for{" "}
            <Link href={`/studio/drops/${campaign.drop_id}`} className="text-accent hover:text-accent-strong">
              {detail.dropName}
            </Link>
          </span>
        ) : null}
      </div>

      <MessageBanner searchParams={bannerParams} />

      <Card className="mt-6">
        <CardHeader title="Creative brief" description="The editorial north star for every asset and post." />
        <form action={saveCampaign} className="grid gap-4">
          <input type="hidden" name="campaign_id" value={campaign.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="name" label="Name">
              <Input id="name" name="name" defaultValue={campaign.name} required />
            </FormField>
            <FormField id="drop_id" label="Drop">
              <select id="drop_id" name="drop_id" defaultValue={campaign.drop_id ?? ""} className={inputClass}>
                <option value="">— none —</option>
                {dropOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="starts_at" label="Starts">
              <Input id="starts_at" name="starts_at" type="datetime-local" defaultValue={campaign.starts_at ? campaign.starts_at.slice(0, 16) : ""} />
            </FormField>
            <FormField id="ends_at" label="Ends">
              <Input id="ends_at" name="ends_at" type="datetime-local" defaultValue={campaign.ends_at ? campaign.ends_at.slice(0, 16) : ""} />
            </FormField>
          </div>
          <FormField id="brief" label="Brief">
            <textarea id="brief" name="brief" rows={3} defaultValue={campaign.brief ?? ""} className={inputClass} />
          </FormField>
          <div>
            <Button type="submit">Save campaign</Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Moodboard & assets"
            description="Every asset carries provenance and needs approval before use (§7.6). Synthetic imagery is disclosed."
          />
          {detail.assets.length === 0 ? (
            <p className="text-sm text-warm-500">No assets yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {[...moodboard, ...copyAssets, ...postAssets].map((asset) => (
                <li key={asset.id} className="border-b border-warm-200 pb-2 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{asset.kind}</Badge>
                    <span className="text-xs text-warm-500">v{asset.version}</span>
                    <Badge
                      tone={
                        asset.approval_status === "approved"
                          ? "success"
                          : asset.approval_status === "rejected"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {asset.approval_status}
                    </Badge>
                    {asset.ai_generation_id ? <Badge tone="accent">AI draft</Badge> : null}
                    {asset.synthetic_disclosed ? <Badge tone="warning">synthetic disclosed</Badge> : null}
                  </div>
                  {asset.asset_path ? (
                    <p className="mt-0.5 break-all text-xs text-warm-500">{asset.asset_path}</p>
                  ) : null}
                  {asset.approval_status === "draft" ? (
                    <div className="mt-1 flex gap-2">
                      {(["approved", "rejected"] as const).map((decision) => (
                        <form key={decision} action={decideAsset}>
                          <input type="hidden" name="asset_id" value={asset.id} />
                          <input type="hidden" name="campaign_id" value={campaign.id} />
                          <input type="hidden" name="decision" value={decision} />
                          <button
                            type="submit"
                            className={`text-xs hover:underline ${decision === "approved" ? "text-success" : "text-danger"}`}
                          >
                            {decision === "approved" ? "approve" : "reject"}
                          </button>
                        </form>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <form action={addAsset} className="mt-4 grid gap-3 border-t border-warm-200 pt-4">
            <input type="hidden" name="campaign_id" value={campaign.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id="a-kind" label="Kind">
                <select id="a-kind" name="kind" className={inputClass}>
                  <option value="image">image</option>
                  <option value="copy">copy</option>
                  <option value="post">post</option>
                </select>
              </FormField>
              <FormField id="a-version" label="Version">
                <Input id="a-version" name="version" type="number" min="1" defaultValue="1" />
              </FormField>
              <FormField id="a-provenance" label="Provenance">
                <select id="a-provenance" name="provenance" className={inputClass}>
                  <option value="operator">operator</option>
                  <option value="seller">seller</option>
                  <option value="ai_synthetic">ai_synthetic</option>
                </select>
              </FormField>
            </div>
            <FormField id="a-path" label="Asset path / URL">
              <Input id="a-path" name="asset_path" placeholder="campaigns/drop-002/hero.jpg" />
            </FormField>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="synthetic_disclosed" className="h-4 w-4" />
              Synthetic imagery — disclosed (§7.6, §10.6)
            </label>
            <div>
              <Button type="submit" variant="secondary" size="sm">
                Add asset (draft)
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Content calendar & channel plan" description="Planned posts per channel; copy variants live here." />
          {detail.posts.length === 0 ? (
            <p className="text-sm text-warm-500">Nothing planned.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.posts.map((post) => (
                <li key={post.id} className="border-b border-warm-200 pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge tone="info">{post.channel}</Badge>
                    <Badge tone={post.state === "published" ? "success" : "neutral"}>{post.state}</Badge>
                    <span className="text-xs text-warm-500">
                      {post.planned_at ? `planned ${formatDate(post.planned_at)}` : "unscheduled"}
                    </span>
                  </div>
                  {post.copy ? <p className="mt-0.5 text-ink">{post.copy}</p> : null}
                </li>
              ))}
            </ul>
          )}
          <form action={addPost} className="mt-4 grid gap-3 border-t border-warm-200 pt-4">
            <input type="hidden" name="campaign_id" value={campaign.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="p-channel" label="Channel">
                <select id="p-channel" name="channel" className={inputClass}>
                  {CAMPAIGN_CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="p-planned" label="Planned at">
                <Input id="p-planned" name="planned_at" type="datetime-local" />
              </FormField>
            </div>
            <FormField id="p-copy" label="Copy variant">
              <textarea id="p-copy" name="copy" rows={2} className={inputClass} />
            </FormField>
            <div>
              <Button type="submit" variant="secondary" size="sm">
                Plan post
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Tracked links"
          description="Campaign + channel + creative → UTM URL (§7.6). utm_campaign is derived from the campaign name."
        />
        {detail.links.length === 0 ? (
          <p className="text-sm text-warm-500">No tracked links yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.links.map((link) => (
              <li key={link.id} className="border-b border-warm-200 pb-2 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge tone="info">{link.channel}</Badge>
                  <span className="text-xs text-warm-500">code: {link.code}</span>
                </div>
                <p className="mt-0.5 break-all text-xs text-accent">{trackedLinkDisplayUrl(link)}</p>
              </li>
            ))}
          </ul>
        )}
        <form action={generateTrackedLink} className="mt-4 grid gap-3 border-t border-warm-200 pt-4">
          <input type="hidden" name="campaign_id" value={campaign.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="l-target" label="Target URL">
              <Input id="l-target" name="target_url" type="url" required placeholder="https://fitarchive.sg/drops/drop-002" />
            </FormField>
            <FormField id="l-channel" label="Channel">
              <select id="l-channel" name="channel" className={inputClass}>
                {CAMPAIGN_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="l-source" label="utm_source">
              <Input id="l-source" name="utm_source" required placeholder="instagram" />
            </FormField>
            <FormField id="l-medium" label="utm_medium">
              <Input id="l-medium" name="utm_medium" required placeholder="social" />
            </FormField>
            <FormField id="l-content" label="utm_content (creative variant)">
              <Input id="l-content" name="utm_content" placeholder="hero-a" />
            </FormField>
            <FormField id="l-post" label="Linked post (optional)">
              <select id="l-post" name="campaign_post_id" className={inputClass}>
                <option value="">— none —</option>
                {detail.posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.channel} · {p.planned_at ? formatDate(p.planned_at) : "unscheduled"}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div>
            <Button type="submit" variant="secondary" size="sm">
              Generate tracked link
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
