import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/ui/logo";
import { getCurrentUser } from "@/lib/supabase/auth.server";

// `absolute` so the landing page is "StockFlow" rather than
// "StockFlow | StockFlow" under the root layout's title template.
export const metadata = {
  title: { absolute: "StockFlow — Inventory and sales management" },
};

/**
 * The public entry point.
 *
 * A visitor who already holds a valid session is sent straight into
 * /dashboard, which resolves their role and forwards them to the right home.
 * Everyone else gets the landing page, which exists to be presentable rather
 * than to market — the product is a tool for a shop's staff, not a consumer
 * app, so the single action is "Sign in".
 *
 * The auth check is deliberately tolerant. `/` is not in the proxy matcher, so
 * no session refresh has run for this request, and getCurrentUser() throws if
 * Supabase rejects the token or is unreachable. A public page must still
 * render in that case, so a failure is treated as "not signed in" rather than
 * being allowed to reach the error boundary.
 */
export default async function Home() {
  const user = await getCurrentUser().catch(() => null);

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-100 text-slate-950">
      <div className="flex flex-col items-center justify-center gap-8 px-6 py-20 sm:py-28">
        <Logo size="lg" priority />

        <div className="max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            StockFlow
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Inventory and sales management for small auto parts shops. Track
            stock batches, prices, and profit from the parts you actually sell.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          Sign in
        </Link>

        <dl className="mt-10 grid max-w-3xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Batch inventory
            </dt>
            <dd className="mt-2 text-sm leading-6 text-slate-600">
              New arrivals create new batches at their own price — older stock
              is never repriced after the fact.
            </dd>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sales &amp; profit
            </dt>
            <dd className="mt-2 text-sm leading-6 text-slate-600">
              Every sale pulls from the exact batches it used, so profit is
              calculated from what actually happened.
            </dd>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Team access
            </dt>
            <dd className="mt-2 text-sm leading-6 text-slate-600">
              Shop owners control who can record sales and who can only view
              them, with a two-assistant limit per shop.
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
