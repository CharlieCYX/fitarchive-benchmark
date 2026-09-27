import type { ReactNode } from "react";
import { SiteFooter } from "@/components/editorial/site-footer";
import { SiteHeader } from "@/components/editorial/site-header";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
