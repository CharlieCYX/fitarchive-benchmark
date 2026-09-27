import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessStudio, ROLE_LABELS } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/env";
import { StudioNav } from "./_components/studio-nav";

export const metadata: Metadata = { title: "Studio" };

/**
 * Operator Studio shell (§7.1). Server-side role guard (never client-trusted):
 * - Supabase unconfigured → demo shell mode with a clear notice.
 * - Signed out → sign-in prompt instead of content.
 * - Signed in but not owner → honest access notice.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const user = await getSessionUser();

  let notice: ReactNode = null;
  let showContent = true;

  if (!configured) {
    notice = (
      <Notice tone="warning">
        Supabase is not configured — Studio is in demo shell mode. Sign-in and
        live data activate once credentials are set (see .env.example).
      </Notice>
    );
  } else if (!user) {
    showContent = false;
    notice = (
      <Notice tone="info">
        Studio is operator-only.{" "}
        <Link href="/login" className="text-accent hover:text-accent-strong">
          Sign in
        </Link>{" "}
        with the operator account to continue.
      </Notice>
    );
  } else if (!canAccessStudio(user.role)) {
    showContent = false;
    notice = (
      <Notice tone="danger">
        Signed in as {ROLE_LABELS[user.role]} — this role does not have Studio
        access. Owner/operator accounts only.
      </Notice>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-warm-200 px-3 py-6">
        <Link href="/" className="block px-3 font-display text-lg tracking-tight text-ink">
          FitArchive
        </Link>
        <p className="px-3 text-xs uppercase tracking-wide text-warm-500">Studio</p>
        <div className="mt-6">
          <StudioNav />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {notice}
        <main className="px-8 py-8">{showContent ? children : null}</main>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "warning" | "info" | "danger"; children: ReactNode }) {
  const classes = {
    warning: "border-warning/30 bg-warning/5 text-warning",
    info: "border-info/30 bg-info/5 text-info",
    danger: "border-danger/30 bg-danger/5 text-danger",
  }[tone];
  return (
    <div role="status" className={`border-b px-8 py-3 text-sm ${classes}`}>
      {children}
    </div>
  );
}
