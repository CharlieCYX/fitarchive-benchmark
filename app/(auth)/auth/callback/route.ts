import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/db/server";

/**
 * GET /auth/callback — magic-link landing (A1). Exchanges the `code` for a
 * session and redirects onward. `next` is constrained to same-origin paths.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  if (code) {
    const supabase = await getServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(
          new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
        );
      }
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
