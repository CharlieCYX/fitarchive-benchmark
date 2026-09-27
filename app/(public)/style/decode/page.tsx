import type { Metadata } from "next";
import { DecodeForm } from "@/features/style-engine/components/decode-form";

export const metadata: Metadata = {
  title: "Decode This Reference",
  description: "A structured read of a style reference — confidence, uncertainty and Singapore translation included.",
};
export const dynamic = "force-dynamic";

export default function DecodePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-wide text-warm-500">§8.5 · Style Engine</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">Decode This Reference</h1>
      <p className="mt-3 text-sm leading-6 text-warm-700">
        Every read carries confidence; low-confidence signals are marked
        uncertain instead of asserted. Distinctive signals are separated from
        incidental ones, heavy materials get breathable Singapore substitutes,
        and matches come only from the real catalog and your closet.
      </p>
      <div className="mt-8">
        <DecodeForm />
      </div>
    </div>
  );
}
