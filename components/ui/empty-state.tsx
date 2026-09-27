import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Honest empty state (§7.1 AC: "helpful empty state"). Used for modules that
 * are planned but not built yet — always says what will exist and when,
 * never a dead button.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-warm-300 bg-warm-100/50 px-6 py-12 text-center",
        className,
      )}
    >
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-warm-700">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
