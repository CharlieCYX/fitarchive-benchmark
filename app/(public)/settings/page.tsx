import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDate } from "@/lib/utils";
import { PrivacyControls } from "./privacy-controls";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/**
 * /settings — profile & privacy (§15.2). Real profile display (role, email,
 * member since), self-service data export and a data-rights (export/delete)
 * request entry recorded in data_rights_requests (0021). Sign-in required;
 * every data read is scoped by RLS to the signed-in user.
 */
export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Settings</h1>
        <EmptyState
          className="mt-8"
          title="Connect Supabase to activate settings"
          description="Profile display, data export and data-rights requests activate once Supabase credentials are set (see .env.example)."
        />
      </div>
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Settings</h1>
        <EmptyState
          className="mt-8"
          title="Sign in to manage your profile and privacy"
          description="Your settings page shows your profile, lets you export everything tied to your account, and file an export/deletion request."
          action={
            <Link href="/login" className="text-sm text-accent hover:text-accent-strong">
              Sign in →
            </Link>
          }
        />
      </div>
    );
  }

  const supabase = await getServerClient();
  const [{ data: profile }, { data: requests }] = supabase
    ? await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, locale, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("data_rights_requests")
          .select("id, kind, status, created_at")
          .eq("profile_id", user.id)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: null }, { data: null }];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display text-2xl text-ink">Settings</h1>

      <section className="mt-8 rounded-lg border border-warm-200 bg-white p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-warm-500">
          Profile
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-warm-500">Email</dt>
            <dd className="text-ink">{user.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-warm-500">Display name</dt>
            <dd className="text-ink">{profile?.display_name ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-warm-500">Role</dt>
            <dd>
              <Badge tone="info">{ROLE_LABELS[user.role]}</Badge>
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-warm-500">Member since</dt>
            <dd className="text-ink">{formatDate(profile?.created_at)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-warm-500">
          Profile edits are handled by the operator in V1 — use a data-rights
          request below if something is wrong.
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-warm-200 bg-white p-5">
        <PrivacyControls />
      </section>

      {(requests ?? []).length > 0 ? (
        <section className="mt-8 rounded-lg border border-warm-200 bg-white p-5">
          <h2 className="text-sm font-medium uppercase tracking-wide text-warm-500">
            Your requests
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(requests ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4">
                <span className="text-warm-700">
                  {r.kind === "delete" ? "Deletion" : "Export"} · {formatDate(r.created_at)}
                </span>
                <Badge tone={r.status === "done" ? "success" : "warning"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
