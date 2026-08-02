import { cn } from "@/lib/utils/cn";

/** The developer credited in the footer, in one place so it reads the same everywhere. */
const AUTHOR = "@adrianniel.dev";

type CreditProps = {
  className?: string;
};

/**
 * The small build credit that sits at the bottom of every screen.
 *
 * Deliberately quiet — slate-400 at text-xs — so it reads as a signature on the
 * work rather than as part of the shop's own interface. The year is not shown:
 * it would either be hardcoded and go stale, or be computed at render time and
 * differ between the server and the client on New Year's Eve.
 */
export function Credit({ className }: CreditProps) {
  return (
    <p className={cn("text-center text-xs text-slate-400", className)}>
      Built by {AUTHOR}
    </p>
  );
}
