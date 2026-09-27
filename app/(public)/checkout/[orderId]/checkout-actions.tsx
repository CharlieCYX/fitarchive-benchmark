"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveDemoCheckoutAction } from "@/features/storefront/actions";

/**
 * Demo checkout resolution buttons (§10.3): simulate payment success or
 * failure. Clearly labeled DEMO — no real payment is ever attempted.
 */
export function CheckoutActions({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function resolve(outcome: "pay" | "fail") {
    setError(null);
    startTransition(async () => {
      const result = await resolveDemoCheckoutAction(orderId, outcome);
      if (result.status === "ok") {
        router.refresh();
      } else if (result.status === "unconfigured") {
        setError("Demo checkout activates when Supabase is connected.");
      } else if (result.status === "auth_required") {
        setError("Sign-in state changed; reload the page.");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => resolve("pay")}
        disabled={pending}
        className="rounded-md bg-ink px-5 py-2 text-sm text-white hover:bg-ink-soft disabled:opacity-50"
      >
        Simulate successful payment
      </button>
      <button
        type="button"
        onClick={() => resolve("fail")}
        disabled={pending}
        className="rounded-md border border-warm-300 px-5 py-2 text-sm text-ink hover:border-warm-500 disabled:opacity-50"
      >
        Simulate failed payment
      </button>
      {error ? <p className="w-full text-sm text-danger">{error}</p> : null}
    </div>
  );
}
