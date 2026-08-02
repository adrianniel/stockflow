import { HeaderSkeleton, PanelSkeleton, StatsSkeleton } from "@/components/ui/skeleton";

/**
 * Shown while any /dashboard page resolves its data on the server.
 *
 * One shared skeleton for every dashboard route rather than a per-page one:
 * they all open with a header, and most follow it with either summary cards or
 * a table, so this shape is close enough everywhere to avoid a visible jump.
 * The sidebar is in the layout and so stays on screen throughout.
 */
export default function DashboardLoading() {
  return (
    <>
      <span className="sr-only" role="status">
        Loading
      </span>

      <HeaderSkeleton />
      <StatsSkeleton />
      <PanelSkeleton />
    </>
  );
}
