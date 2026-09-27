import type { Metadata } from "next";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadClosetGarments } from "@/features/style-engine/service";
import { BuildForm } from "@/features/style-engine/components/build-form";

export const metadata: Metadata = {
  title: "Build My Fit",
  description: "References in, a wearable fit thesis out — owned pieces first, hard constraints always.",
};
export const dynamic = "force-dynamic";

export default async function BuildPage() {
  const supabase = await getServerClient();
  const user = await getSessionUser();
  const closet =
    supabase && user ? await loadClosetGarments(supabase, user.id) : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-wide text-warm-500">§8.3 · Style Engine</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">Build My Fit</h1>
      <p className="mt-3 text-sm leading-6 text-warm-700">
        References become shared signals; contradictions are named, not
        smoothed over. The recommendation uses your closet and the live
        catalog — never an item that is sold, over budget, rejected by you,
        or wrong for the climate.
      </p>
      <div className="mt-8">
        <BuildForm
          closetItems={closet.map((c) => ({ id: c.id, label: c.label }))}
          signedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
