import { Credit } from "@/components/ui/credit";
import { Logo } from "@/components/ui/logo";

/**
 * Shown while the login route resolves on the server.
 *
 * Brief in practice — the page only awaits its searchParams — but the route is
 * in the proxy matcher, so a slow session refresh can delay it. Mirrors the
 * login card's shape so the real form does not arrive as a jump.
 */
export default function LoginLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <span className="sr-only" role="status">
          Loading
        </span>

        <div className="flex flex-col items-center gap-3">
          <Logo size="lg" />

          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              StockFlow
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Inventory and sales management
            </p>
          </div>
        </div>

        <div aria-hidden className="mt-8 animate-pulse space-y-5">
          <div className="h-[4.5rem] rounded-2xl bg-slate-100" />
          <div className="h-[4.5rem] rounded-2xl bg-slate-100" />
          <div className="h-11 rounded-2xl bg-slate-200" />
        </div>
      </div>

      <Credit />
    </main>
  );
}
