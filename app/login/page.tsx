import { Credit } from "@/components/ui/credit";
import { Logo } from "@/components/ui/logo";

import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

/**
 * The `blocked` parameter is set by the route guards (lib/auth/guards.ts) when a
 * session is valid to Supabase but refused by the app. Kept as a server
 * component so the notice is in the first HTML response rather than appearing
 * after hydration.
 */
type LoginPageProps = {
  searchParams: Promise<{ blocked?: string }>;
};

const NOTICES: Record<string, string> = {
  account:
    "This account has been deactivated. Ask the shop owner to reactivate it, or sign in with a different account.",
  shop: "This shop is currently inactive. Contact StockFlow support to have it reactivated.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { blocked } = await searchParams;
  const notice = blocked ? NOTICES[blocked] : undefined;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-100 p-4 text-slate-950">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col items-center gap-3">
          <Logo size="lg" priority />

          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">StockFlow</h1>
            <p className="mt-1 text-sm text-slate-500">
              Inventory and sales management
            </p>
          </div>
        </div>

        {notice ? (
          <p
            role="alert"
            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {notice}
          </p>
        ) : null}

        <LoginForm
          blocked={blocked === "account" || blocked === "shop" ? blocked : undefined}
        />
      </div>

      <Credit />
    </main>
  );
}
