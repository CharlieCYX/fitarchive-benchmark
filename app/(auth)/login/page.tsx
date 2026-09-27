import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { Card } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/**
 * /login — passwordless email magic link (ASSUMPTIONS A1).
 * When Supabase env vars are absent the page says so plainly instead of
 * rendering a form that cannot work.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const configured = isSupabaseConfigured();
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-display text-xl tracking-tight text-ink">
          FitArchive
        </Link>
        <h1 className="mt-8 font-display text-2xl text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-warm-700">
          Passwordless — we email you a sign-in link.
        </p>

        {typeof error === "string" ? (
          <p role="alert" className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            Sign-in failed: {error}
          </p>
        ) : null}

        <Card className="mt-6">
          {configured ? (
            <LoginForm />
          ) : (
            <div role="status" className="text-sm text-warm-700">
              <p className="font-medium text-ink">Sign-in is not configured yet.</p>
              <p className="mt-2">
                This deployment has no Supabase credentials (
                <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
                <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>).
                Set them per <code className="text-xs">.env.example</code> and
                reload — the rest of the site remains browsable in the meantime.
              </p>
            </div>
          )}
        </Card>

        <p className="mt-6 text-xs text-warm-500">
          <Link href="/" className="hover:text-ink">
            ← Back to FitArchive
          </Link>
        </p>
      </div>
    </div>
  );
}
