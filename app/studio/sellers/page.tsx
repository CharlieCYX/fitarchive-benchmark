import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Sellers" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Sellers"
      spec="§7.4"
      phase="Phase 2"
      summary="Seller CRM, permission ledger, agreements, settlements."
    />
  );
}
