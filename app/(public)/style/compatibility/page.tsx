import type { Metadata } from "next";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadClosetGarments } from "@/features/style-engine/service";
import { CompatibilityForm } from "@/features/style-engine/components/compatibility-form";

export const metadata: Metadata = {
  title: "Can This Work?",
  description: "A deterministic verdict on two pieces — with repair moves, never vibes.",
};
export const dynamic = "force-dynamic";

export default async function CompatibilityPage() {
  const supabase = await getServerClient();
  const user = await getSessionUser();
  const closet =
    supabase && user ? await loadClosetGarments(supabase, user.id) : [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-wide text-warm-500">§8.4 · Style Engine</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">Can This Work?</h1>
      <p className="mt-3 text-sm leading-6 text-warm-700">
        Describe two pieces (or prefill from your closet). The verdict —
        compatible, tension-but-usable, or contradictory — comes from seven
        scored dimensions, and every weakness comes with a specific repair move.
      </p>
      <div className="mt-8">
        <CompatibilityForm
          closetItems={closet.map((c) => ({ id: c.id, label: c.label, category: c.category }))}
          signedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
