import Link from "next/link";

import { Logo } from "@/components/ui/logo";

/**
 * Shown for any URL that matches no route, and for any page that calls
 * notFound() — the detail pages use it when an id belongs to another shop,
 * since "does not exist" and "is not yours" should be indistinguishable from
 * outside.
 *
 * Both links are offered because this page is reachable signed in or out:
 * /dashboard redirects to /login when there is no session, so neither link is
 * a dead end.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex justify-center">
          <Logo size="lg" />
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-slate-950">
          Page not found
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          That page does not exist, or it belongs to a shop you do not have
          access to.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Go to dashboard
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
