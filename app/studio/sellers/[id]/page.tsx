import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatDate, formatSgd } from "@/lib/utils";
import {
  addContact,
  createAgreement,
  requestPermission,
  transitionPermission,
} from "@/features/sellers/actions";
import {
  allowedPermissionTransitions,
  isPermissionValid,
  PERMISSION_STATE_LABELS,
  PERMISSION_STATES,
} from "@/features/sellers/permissions";
import {
  CONTRIBUTION_DISCLAIMER,
  CONTRIBUTION_LABEL,
  describeSellerTerms,
  settlementStatusLabel,
} from "@/features/sellers/settlement-display";
import { getSellerDetail } from "@/features/sellers/service";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Seller detail" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function SellerDetailPage({
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
        title="Seller CRM + Permission Ledger"
        spec="§7.4"
        summary="Seller profile, contacts, permissions, agreements, settlements."
      />
    );
  }

  const [{ id }, bannerParams] = await Promise.all([params, searchParams]);
  const [detail, { data: products }] = await Promise.all([
    getSellerDetail(supabase, id),
    supabase
      .from("products")
      .select("id, sku, title")
      .eq("seller_id", id)
      .order("sku"),
  ]);
  if (!detail) notFound();

  const sellerProducts = (products ?? []) as Array<{ id: string; sku: string; title: string }>;

  return (
    <div className="max-w-5xl">
      <Link href="/studio/sellers" className="text-sm text-warm-500 hover:text-ink">
        ← Sellers
      </Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="font-display text-2xl text-ink">{detail.seller.display_name}</h1>
        <Badge tone={detail.seller.status === "active" ? "success" : "neutral"}>
          {detail.seller.status}
        </Badge>
        <span className="text-sm text-warm-500">{detail.seller.handle}</span>
      </div>
      {detail.seller.notes_private ? (
        <p className="mt-1 text-sm text-warm-500">
          Private notes (owner-only): {detail.seller.notes_private}
        </p>
      ) : null}

      <MessageBanner searchParams={bannerParams} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contacts" description="Channel handles only — no banking secrets (§15.3)." />
          {detail.contacts.length === 0 ? (
            <p className="text-sm text-warm-500">No contacts recorded.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {detail.contacts.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <Badge tone={c.is_preferred ? "accent" : "neutral"}>{c.channel}</Badge>
                  <span className="text-ink">{c.value}</span>
                  {c.is_preferred ? <span className="text-xs text-warm-500">preferred</span> : null}
                </li>
              ))}
            </ul>
          )}
          <form action={addContact} className="mt-4 grid grid-cols-[120px_1fr_auto] items-end gap-2">
            <input type="hidden" name="seller_id" value={id} />
            <FormField id="c-channel" label="Channel">
              <select id="c-channel" name="channel" className={inputClass}>
                <option value="carousell">carousell</option>
                <option value="ig">ig</option>
                <option value="email">email</option>
                <option value="phone">phone</option>
                <option value="other">other</option>
              </select>
            </FormField>
            <FormField id="c-value" label="Value">
              <Input id="c-value" name="value" required />
            </FormField>
            <Button type="submit" variant="secondary" size="sm">
              Add
            </Button>
            <label className="col-span-3 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="is_preferred" className="h-4 w-4" />
              Preferred channel
            </label>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Agreements"
            description="Commission / consignment / referral terms (§10.1). Terms feed settlement math (DATA_MODEL §6)."
          />
          {detail.agreements.length === 0 ? (
            <p className="text-sm text-warm-500">No agreements recorded.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {detail.agreements.map((a) => (
                <li key={a.id} className="border-b border-warm-200 pb-2 last:border-0">
                  <span className="text-ink">{describeSellerTerms(a)}</span>{" "}
                  <Badge tone={a.status === "active" ? "success" : "neutral"}>{a.status}</Badge>
                  <p className="mt-0.5 text-xs text-warm-500">
                    {a.fulfillment_responsibility
                      ? `Fulfillment: ${a.fulfillment_responsibility}`
                      : "Fulfillment: not specified"}
                    {a.return_terms ? ` · Returns: ${a.return_terms}` : " · Returns: not specified"}
                    {a.ends_at ? ` · ends ${formatDate(a.ends_at)}` : ""}
                    {a.payout_reference ? ` · payout ref: ${a.payout_reference}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <form action={createAgreement} className="mt-4 grid gap-3">
            <input type="hidden" name="seller_id" value={id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="ag-type" label="Type">
                <select id="ag-type" name="type" className={inputClass}>
                  <option value="consignment">consignment</option>
                  <option value="referral">referral</option>
                  <option value="owned">owned</option>
                  <option value="content_collaboration">content_collaboration</option>
                </select>
              </FormField>
              <FormField id="ag-share" label="Seller share %">
                <Input id="ag-share" name="seller_share_pct" type="number" min="0" max="100" step="0.1" />
              </FormField>
              <FormField id="ag-fixed" label="OR fixed amount (SGD)">
                <Input id="ag-fixed" name="seller_fixed_amount_sgd" type="number" min="0" step="0.01" />
              </FormField>
              <FormField id="ag-fulfillment" label="Fulfillment responsibility">
                <Input id="ag-fulfillment" name="fulfillment_responsibility" placeholder="seller ships / fitarchive ships" />
              </FormField>
              <FormField id="ag-returns" label="Return terms">
                <Input id="ag-returns" name="return_terms" placeholder="no returns on consignment" />
              </FormField>
              <FormField id="ag-payout" label="Payout reference (nickname only)">
                <Input id="ag-payout" name="payout_reference" />
              </FormField>
            </div>
            <div>
              <Button type="submit" variant="secondary" size="sm">
                Record agreement
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Permission ledger"
          description="§5.2 lifecycle. Revoking unpublishes affected products server-side and writes audit entries."
        />
        {detail.permissions.length === 0 ? (
          <p className="text-sm text-warm-500">No permission records.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Scope</TH>
                <TH>Product</TH>
                <TH>State</TH>
                <TH>Valid for publish</TH>
                <TH>Granted / expires</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {detail.permissions.map((p) => (
                <TR key={p.id}>
                  <TD>{p.scope}</TD>
                  <TD>
                    {p.product_id ? (
                      <Link href={`/studio/catalog/${p.product_id}`} className="text-accent hover:text-accent-strong">
                        {p.product_title ?? p.product_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-warm-500">seller-wide</span>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={p.state === "expired_revoked" ? "danger" : "info"}>
                      {PERMISSION_STATE_LABELS[p.state]}
                    </Badge>
                  </TD>
                  <TD>{isPermissionValid(p) ? <Badge tone="success">valid</Badge> : "—"}</TD>
                  <TD className="text-xs text-warm-500">
                    {p.granted_at ? formatDate(p.granted_at) : "—"} /{" "}
                    {p.expires_at ? formatDate(p.expires_at) : "—"}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {allowedPermissionTransitions(p.state).map((to) => (
                        <form key={to} action={transitionPermission}>
                          <input type="hidden" name="permission_id" value={p.id} />
                          <input type="hidden" name="seller_id" value={id} />
                          <input type="hidden" name="to" value={to} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className={to === "expired_revoked" ? "text-danger" : undefined}
                          >
                            → {to === "expired_revoked" ? "revoke" : PERMISSION_STATE_LABELS[to]}
                          </Button>
                        </form>
                      ))}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <form action={requestPermission} className="mt-4 grid gap-3 border-t border-warm-200 pt-4 sm:grid-cols-4">
          <input type="hidden" name="seller_id" value={id} />
          <FormField id="p-scope" label="Scope">
            <select id="p-scope" name="scope" className={inputClass}>
              <option value="representation">representation</option>
              <option value="media">media</option>
              <option value="alteration">alteration</option>
            </select>
          </FormField>
          <FormField id="p-product" label="Product (optional)">
            <select id="p-product" name="product_id" className={inputClass}>
              <option value="">seller-wide</option>
              {sellerProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="p-state" label="Initial state">
            <select id="p-state" name="state" className={inputClass}>
              {PERMISSION_STATES.filter((s) => s !== "expired_revoked").map((s) => (
                <option key={s} value={s}>
                  {PERMISSION_STATE_LABELS[s]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="p-expires" label="Expires at (optional)">
            <Input id="p-expires" name="expires_at" type="datetime-local" />
          </FormField>
          <div>
            <Button type="submit" variant="secondary" size="sm">
              Record permission
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Settlement history"
          description={`${CONTRIBUTION_LABEL} — ${CONTRIBUTION_DISCLAIMER} Never labeled "net profit" (§10.4).`}
        />
        {detail.settlements.length === 0 ? (
          <p className="text-sm text-warm-500">No settlements yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Period</TH>
                <TH>Gross sale</TH>
                <TH>Platform fees</TH>
                <TH>Seller base</TH>
                <TH>FA gross</TH>
                <TH>{CONTRIBUTION_LABEL}</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {detail.settlements.map((s) => (
                <TR key={s.id}>
                  <TD className="text-warm-500">
                    {formatDate(s.period_start)} → {formatDate(s.period_end)}
                  </TD>
                  <TD>{formatSgd(s.gross_sale_sgd)}</TD>
                  <TD>{formatSgd(s.platform_fees_sgd)}</TD>
                  <TD>{formatSgd(s.seller_base_sgd)}</TD>
                  <TD>{formatSgd(s.fitarchive_gross_sgd)}</TD>
                  <TD>{formatSgd(s.fitarchive_contribution_sgd)}</TD>
                  <TD>
                    <Badge tone={s.status === "paid" ? "success" : "warning"}>
                      {settlementStatusLabel(s.status)}
                      {s.paid_at ? ` · ${formatDate(s.paid_at)}` : ""}
                    </Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
