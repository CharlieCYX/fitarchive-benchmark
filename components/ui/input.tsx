import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink",
          "placeholder:text-warm-500",
          "focus:border-ink focus:outline-none",
          "disabled:cursor-not-allowed disabled:bg-warm-100",
          className,
        )}
        {...props}
      />
    );
  },
);
