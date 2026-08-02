"use client";

import { ErrorCard } from "@/components/ui/error-card";

/**
 * Error boundary for every page under /dashboard.
 *
 * This is the boundary lib/shop/queries.ts is written to throw into: the query
 * helpers deliberately do not swallow database failures, on the grounds that a
 * page showing zero products is indistinguishable from a shop that has none,
 * and a wrong number is worse than an honest error.
 *
 * It renders inside the dashboard layout, so the sidebar stays put and only
 * the failed page is replaced — the user can navigate somewhere else without
 * losing the shell. `reset()` re-runs the segment, which is enough to recover
 * from a dropped connection or a timed-out query.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center py-10">
      <ErrorCard
        digest={error.digest}
        onRetry={reset}
        description="This page could not load its data. The problem was logged — retrying often clears it. If it keeps happening, check that the database is reachable."
      />
    </div>
  );
}
