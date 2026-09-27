import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatDate } from "@/lib/utils";
import { createCampaign } from "@/features/campaigns/actions";
import { listCampaigns } from "@/features/campaigns/service";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Campaign Studio"
        spec="§7.6"
        summary="Briefs, moodboards, content calendar, channel plan, tracked links, asset approval."
      />
    );
  }

  const params = await searchParams;
  const [campaigns, { data: drops }] = await Promise.all([
    listCampaigns(supabase),
    supabase.from("drops").select("id, name").order("created_at", { ascending: false }),
  ]);
  const dropOptions = (drops ?? []) as Array<{ id: string; name: string }>;

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Campaigns</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        Campaign Studio (§7.6): one campaign per drop, creative brief,
        moodboard, calendar, channel plan and tracked links. Assets stay draft
        until approved; synthetic imagery is disclosed.
      </p>

      <MessageBanner searchParams={params} />

      <Card className="mt-6">
        <CardHeader title="New campaign" description="Usually one campaign per drop; unattached campaigns are allowed for evergreen pushes." />
        <form action={createCampaign} className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Name">
            <Input id="name" name="name" required placeholder="Drop #002 launch" />
          </FormField>
          <FormField id="drop_id" label="Drop">
            <select id="drop_id" name="drop_id" className={inputClass}>
              <option value="">— none —</option>
              {dropOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="starts_at" label="Starts">
            <Input id="starts_at" name="starts_at" type="datetime-local" />
          </FormField>
          <FormField id="ends_at" label="Ends">
            <Input id="ends_at" name="ends_at" type="datetime-local" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="brief" label="Creative brief">
              <textarea id="brief" name="brief" rows={2} className={inputClass} />
            </FormField>
          </div>
          <div>
            <Button type="submit">Create campaign</Button>
          </div>
        </form>
      </Card>

      {campaigns.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No campaigns yet"
          description="Create a campaign for your next drop, then add assets, plan posts and generate tracked links."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Campaign</TH>
              <TH>Drop</TH>
              <TH>Status</TH>
              <TH>Window</TH>
              <TH>Assets</TH>
            </TR>
          </THead>
          <TBody>
            {campaigns.map((campaign) => (
              <TR key={campaign.id}>
                <TD>
                  <Link
                    href={`/studio/campaigns/${campaign.id}`}
                    className="font-medium text-accent hover:text-accent-strong"
                  >
                    {campaign.name}
                  </Link>
                </TD>
                <TD>{campaign.drop_name ?? "—"}</TD>
                <TD>
                  <Badge tone={campaign.status === "active" ? "success" : "neutral"}>
                    {campaign.status}
                  </Badge>
                </TD>
                <TD className="text-warm-500">
                  {formatDate(campaign.starts_at)} → {formatDate(campaign.ends_at)}
                </TD>
                <TD>
                  {campaign.asset_count}
                  {campaign.pending_assets > 0 ? (
                    <Badge tone="warning" className="ml-2">
                      {campaign.pending_assets} awaiting approval
                    </Badge>
                  ) : null}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
