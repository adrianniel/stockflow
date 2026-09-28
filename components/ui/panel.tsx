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
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_36px_rgba(15,23,42,0.06)] sm:rounded-3xl sm:p-5",
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
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-[#07152e] sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 sm:text-sm sm:leading-6">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
