"use client";

import { useState, type FormEvent } from "react";
import { getBrowserClient } from "@/lib/db/browser";
import { magicLinkSchema } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";

type Status = "idle" | "sending" | "sent" | "error";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = magicLinkSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      setStatus("error");
      return;
    }

    const supabase = getBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured on this deployment.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (otpError) {
      setError(otpError.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="text-sm text-warm-700">
        <p className="font-medium text-ink">Check your inbox.</p>
        <p className="mt-2">
          If an account can be created for <span className="text-ink">{email}</span>,
          a sign-in link is on its way. The link opens FitArchive in this browser.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormField id="email" label="Email address" error={error}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </FormField>
      <Button type="submit" className="mt-4 w-full" disabled={status === "sending"}>
        {status === "sending" ? "Sending link…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
