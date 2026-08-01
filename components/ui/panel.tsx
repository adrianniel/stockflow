import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PanelProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The standard surface for dashboard content: tables, forms, summaries.
 *
 * Every card in the app shares one border/shadow recipe so new pages match the
 * existing ones without copying the class string around.
 */
export function Panel({ children, className }: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}

type PanelHeaderProps = {
  title: string;
  description?: string;
  /** Buttons or filters aligned to the right of the title. */
  actions?: ReactNode;
};

export function PanelHeader({ title, description, actions }: PanelHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
