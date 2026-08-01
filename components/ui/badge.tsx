import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "positive" | "warning" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

type BadgeProps = {
  children: ReactNode;
  /**
   * Colour only. The label still has to say what the state is — colour alone
   * is not an accessible signal.
   */
  tone?: BadgeTone;
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
