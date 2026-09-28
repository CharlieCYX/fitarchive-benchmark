import Link from "next/link";

/**
 * Public editorial chrome. Links only go to routes that exist in this phase;
 * future routes are labeled in copy, never linked (§2.2: no dead nav).
 */
export function SiteHeader() {
  return (
    <header className="border-b border-warm-200">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl tracking-tight text-ink">
          FitArchive
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/drops" className="text-warm-700 hover:text-ink">
            Drops
          </Link>
          <Link href="/search" className="text-warm-700 hover:text-ink">
            Search
          </Link>
          <Link href="/style" className="text-warm-700 hover:text-ink">
            Style
          </Link>
          <Link href="/archive" className="text-warm-700 hover:text-ink">
            Archive
          </Link>
          <Link href="/seller" className="text-warm-700 hover:text-ink">
            Sellers
          </Link>
          <Link href="/studio" className="text-warm-700 hover:text-ink">
            Studio <span className="text-warm-500">(operators)</span>
          </Link>
          <Link href="/settings" className="text-warm-700 hover:text-ink">
            Settings
          </Link>
          <Link href="/login" className="text-accent hover:text-accent-strong">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
