import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-warm-200 bg-white p-6", className)}
      {...props}
    />
  );
}

export function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-display text-lg text-ink">{title}</h3>
      {description ? <p className="mt-1 text-sm text-warm-700">{description}</p> : null}
    </div>
  );
}

export function CardContent({ children }: { children: ReactNode }) {
  return <div className="text-sm text-ink">{children}</div>;
}
