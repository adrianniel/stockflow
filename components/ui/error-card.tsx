"use client";

import Link from "next/link";

import { Logo } from "@/components/ui/logo";

/**
 * The shared body of every error screen.
 *
 * Error boundaries in the App Router must be client components, so this holds
 * the markup all of them reuse: app/error.tsx, app/dashboard/error.tsx and
 * app/global-error.tsx differ only in what surrounds them.
 *
 * Two rules govern what is shown. The message is generic, because a thrown
 * database error can carry column names, constraint names, or fragments of a
 * failed query, and none of that belongs in front of a shop assistant. The
 * digest is shown instead: Next.js logs the real error on the server under
 * that same hash, so it is the one string that makes a user's report traceable
 * without leaking anything.
 */

type ErrorCardProps = {
  /** Passed straight through from the boundary's `error` prop. */
  digest?: string;
  /** The boundary's `reset` — re-renders the segment without a full reload. */
  onRetry: () => void;
  title?: string;
  description?: string;
  /** Hidden on the global boundary, where app chrome may not be reachable. */
  showHomeLink?: boolean;
};

export function ErrorCard({
  digest,
  onRetry,
  title = "Something went wrong",
  description = "This page could not be loaded. The problem was logged — retrying often clears it.",
  showHomeLink = true,
}: ErrorCardProps) {
  return (
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex justify-center">
        <Logo size="lg" />
      </div>

      <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h1>

      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

      {digest ? (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Reference code{" "}
          <span className="font-mono font-medium text-slate-700">{digest}</span>
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          Try again
        </button>

        {showHomeLink ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Back to dashboard
          </Link>
        ) : null}
      </div>
    </div>
  );
}
