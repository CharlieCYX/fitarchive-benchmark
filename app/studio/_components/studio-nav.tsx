"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { STUDIO_SECTIONS } from "./sections";

export function StudioNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Studio sections" className="space-y-1">
      <NavItem href="/studio" label="Command Center" active={pathname === "/studio"} />
      {STUDIO_SECTIONS.map((section) => (
        <NavItem
          key={section.href}
          href={section.href}
          label={section.title}
          active={pathname === section.href}
        />
      ))}
    </nav>
  );
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "block rounded-md px-3 py-1.5 text-sm",
        active ? "bg-warm-100 font-medium text-ink" : "text-warm-700 hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}
