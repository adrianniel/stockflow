import { cn } from "@/lib/utils/cn";

/**
 * Loading placeholders.
 *
 * These mirror the shape of the real content — a panel with a header and rows,
 * or a row of summary cards — so the page does not visibly jump when the data
 * arrives. `animate-pulse` is the only motion; nothing here spins.
 *
 * Marked aria-hidden and paired with a visually hidden "Loading" message in the
 * route's loading.tsx, so a screen reader hears one announcement instead of
 * reading out a tree of empty boxes.
 */

function Bar({ className }: { className?: string }) {
  return <div className={cn("rounded-lg bg-slate-200", className)} />;
}

/** Stands in for a DashboardHeader while the page resolves. */
export function HeaderSkeleton() {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-6"
    >
      <Bar className="h-4 w-32" />
      <Bar className="mt-3 h-8 w-64" />
      <Bar className="mt-3 h-4 w-full max-w-md" />
    </div>
  );
}

/** Stands in for a Panel containing a table. */
export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
    >
      <Bar className="h-5 w-40" />
      <Bar className="mt-2 h-4 w-72 max-w-full" />

      <div className="mt-6 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Bar key={index} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Stands in for the row of summary cards at the top of a dashboard. */
export function StatsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-hidden className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        >
          <Bar className="h-4 w-24" />
          <Bar className="mt-4 h-9 w-32" />
          <Bar className="mt-4 h-4 w-20" />
        </div>
      ))}
    </div>
  );
}
