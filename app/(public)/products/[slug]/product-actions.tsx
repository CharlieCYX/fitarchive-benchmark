"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/events/track";
import {
  startDemoCheckoutAction,
  toggleFavorite,
} from "@/features/storefront/actions";

/**
 * PDP shopper actions (§8.1): save (login-gated), share, inquiry, and the
 * purchase path appropriate to the ownership model — demo checkout for
 * owned/consigned pieces, tracked outbound click for referral pieces.
 * Every failure mode renders an honest message; nothing is a dead button.
 */
export function ProductActions({
  productId,
  productSlug,
  productTitle,
  availability,
  purchaseMode,
  referral,
}: {
  productId: string;
  productSlug: string;
  productTitle: string;
  availability: string;
  purchaseMode: "checkout" | "referral" | "none";
  referral: { destination: string; trackedLinkId: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const purchasable = availability === "available";

  function onSave() {
    startTransition(async () => {
      const result = await toggleFavorite(productId);
      if (result.status === "ok") {
        setSaved(result.saved ?? false);
        setSaveMessage(null);
      } else if (result.status === "auth_required") {
        setSaveMessage("auth");
      } else if (result.status === "unconfigured") {
        setSaveMessage("Saves activate when Supabase is connected.");
      } else {
        setSaveMessage(result.message);
      }
    });
  }

  function onShare(channel: string) {
    const url = `${window.location.origin}/products/${productSlug}`;
    void trackEvent("share_click", { product_id: productId, channel });
    if (channel === "copy_link") {
      void navigator.clipboard
        ?.writeText(url)
        .then(() => setShareMessage("Link copied."))
        .catch(() => setShareMessage(url));
      return;
    }
    const text = encodeURIComponent(`${productTitle} — FitArchive`);
    const target =
      channel === "whatsapp"
        ? `https://wa.me/?text=${text}%20${encodeURIComponent(url)}`
        : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`;
    window.open(target, "_blank", "noopener,noreferrer");
  }

  function onInquirySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void trackEvent("inquiry_start", { product_id: productId, method: "form" });
    setInquirySent(true);
  }

  function onDemoBuy() {
    setCheckoutError(null);
    startTransition(async () => {
      const result = await startDemoCheckoutAction(productId, {
        name: buyerName || null,
        email: buyerEmail || null,
      });
      if (result.status === "ok") {
        router.push(`/checkout/${result.orderId}`);
      } else if (result.status === "unconfigured") {
        setCheckoutError("Demo checkout activates when Supabase is connected.");
      } else {
        setCheckoutError(result.message);
      }
    });
  }

  function onExternalBuy() {
    if (!referral) return;
    void trackEvent("external_buy_click", {
      product_id: productId,
      destination: referral.destination,
      tracked_link_id: referral.trackedLinkId,
    });
  }

  return (
    <div className="space-y-6">
      {/* Save + share */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={pending}
          className="rounded-md border border-warm-300 px-4 py-2 text-sm text-ink hover:border-warm-500 disabled:opacity-50"
        >
          {saved ? "Saved ✓" : "Save to archive"}
        </button>
        <button
          type="button"
          onClick={() => onShare("copy_link")}
          className="rounded-md border border-warm-300 px-4 py-2 text-sm text-ink hover:border-warm-500"
        >
          Copy link
        </button>
        <button
          type="button"
          onClick={() => onShare("whatsapp")}
          className="rounded-md border border-warm-300 px-4 py-2 text-sm text-ink hover:border-warm-500"
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => onShare("telegram")}
          className="rounded-md border border-warm-300 px-4 py-2 text-sm text-ink hover:border-warm-500"
        >
          Telegram
        </button>
      </div>
      {saveMessage === "auth" ? (
        <p className="text-sm text-warm-700">
          Saving pieces needs an account —{" "}
          <Link href="/login" className="text-accent hover:text-accent-strong">
            sign in with email
          </Link>{" "}
          (passwordless) and your archive is private by default.
        </p>
      ) : saveMessage ? (
        <p className="text-sm text-warm-700">{saveMessage}</p>
      ) : null}
      {shareMessage ? (
        <p className="text-sm text-warm-700">{shareMessage}</p>
      ) : null}

      {/* Purchase path */}
      {purchaseMode === "checkout" && purchasable ? (
        <div className="rounded-lg border border-warm-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-warm-500">
            Demo checkout — simulated payment, no real charge
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Name (optional)"
              className="rounded-md border border-warm-300 px-3 py-2 text-sm text-ink"
            />
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="Email (optional)"
              className="rounded-md border border-warm-300 px-3 py-2 text-sm text-ink"
            />
          </div>
          <button
            type="button"
            onClick={onDemoBuy}
            disabled={pending}
            className="mt-3 rounded-md bg-ink px-5 py-2 text-sm text-white hover:bg-ink-soft disabled:opacity-50"
          >
            Buy — demo checkout
          </button>
          {checkoutError ? (
            <p className="mt-2 text-sm text-danger">{checkoutError}</p>
          ) : null}
        </div>
      ) : purchaseMode === "referral" && referral ? (
        <div className="rounded-lg border border-warm-200 bg-white p-4">
          <p className="text-sm leading-relaxed text-warm-700">
            This piece is sold by an external seller on their platform. The
            click is attributed through a FitArchive tracked link so the
            referral loop is measurable.
          </p>
          <a
            href={referral.destination}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onExternalBuy}
            className="mt-3 inline-block rounded-md bg-accent px-5 py-2 text-sm text-white hover:bg-accent-strong"
          >
            Buy on the seller&apos;s platform →
          </a>
        </div>
      ) : purchaseMode === "checkout" && !purchasable ? (
        <p className="rounded-lg border border-warm-200 bg-warm-100/50 px-4 py-3 text-sm text-warm-700">
          This piece is {availability}.{" "}
          {availability === "sold"
            ? "Sold pieces stay visible as part of the archive."
            : "It is currently reserved for another checkout."}
        </p>
      ) : (
        <p className="rounded-lg border border-warm-200 bg-warm-100/50 px-4 py-3 text-sm text-warm-700">
          Not for sale — see the ownership note above.
        </p>
      )}

      {/* Inquiry */}
      <div className="border-t border-warm-200 pt-4">
        {inquiryOpen ? (
          inquirySent ? (
            <p className="text-sm text-warm-700">
              Inquiry recorded (event <code>inquiry_start</code>). This
              benchmark has no message inbox — reach the operator at{" "}
              <a
                href={`mailto:studio@fitarchive.demo?subject=Inquiry: ${encodeURIComponent(productTitle)}`}
                className="text-accent hover:text-accent-strong"
              >
                studio@fitarchive.demo
              </a>
              .
            </p>
          ) : (
            <form onSubmit={onInquirySubmit} className="space-y-2">
              <label className="block text-xs text-warm-500">
                Your question (recorded as an inquiry event)
                <textarea
                  required
                  rows={3}
                  className="mt-1 w-full rounded-md border border-warm-300 px-3 py-2 text-sm text-ink"
                  placeholder="Sizing, condition detail, styling…"
                />
              </label>
              <button
                type="submit"
                className="rounded-md border border-warm-300 px-4 py-2 text-sm text-ink hover:border-warm-500"
              >
                Send inquiry
              </button>
            </form>
          )
        ) : (
          <button
            type="button"
            onClick={() => setInquiryOpen(true)}
            className="text-sm text-accent hover:text-accent-strong"
          >
            Ask about this piece →
          </button>
        )}
      </div>
    </div>
  );
}
