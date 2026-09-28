import { redirect } from "next/navigation";
import Image from "next/image";

import { Credit } from "@/components/ui/credit";
import { Logo } from "@/components/ui/logo";
import { getCurrentUser } from "@/lib/supabase/auth.server";

import { LoginForm } from "./login/login-form";

export const metadata = {
  title: { absolute: "StockFlow — Inventory and sales management" },
};

const NOTICES: Record<string, string> = {
  account:
    "This account has been deactivated. Ask the shop owner to reactivate it, or sign in with a different account.",
  shop: "This shop is currently inactive. Contact StockFlow support to have it reactivated.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ blocked?: string }>;
}) {
  const [{ blocked }, user] = await Promise.all([
    searchParams,
    getCurrentUser().catch(() => null),
  ]);

  if (user && blocked !== "account" && blocked !== "shop") {
    redirect("/dashboard");
  }

  const notice = blocked ? NOTICES[blocked] : undefined;
  const blockedRole =
    blocked === "account" || blocked === "shop" ? blocked : undefined;

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#07152e] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src="/landing.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-[#07152e]/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07152e]/30 via-[#07152e]/35 to-[#07152e]/75" />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <Logo size="md" priority />
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">StockFlow</p>
            <p className="text-xs text-slate-400">Inventory, clearly managed.</p>
          </div>
        </div>
        <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 sm:inline-flex">
          Built for independent shops
        </span>
      </header>

      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center gap-9 px-4 py-6 sm:gap-12 sm:px-8 sm:py-10 md:grid md:grid-cols-[minmax(0,1fr)_minmax(340px,440px)] md:items-center md:gap-10 md:py-14 lg:px-10">
        <div className="order-2 w-full max-w-2xl md:order-1">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" />
            Inventory that adds up
          </p>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Know your stock.
            <span className="block text-blue-300">Know your profit.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Keep batches, sales, expenses, and shop performance in one clear
            place. StockFlow helps your team make confident decisions from the
            numbers that matter.
          </p>

          <div className="mt-7 hidden max-w-xl gap-3 md:grid md:grid-cols-1 lg:mt-9 lg:grid-cols-3">
            <Feature title="Batch-aware stock" detail="Keep each arrival and price distinct." />
            <Feature title="Accurate profit" detail="Use the real batch cost and sale price." />
            <Feature title="Shop-level access" detail="Your team's data stays yours." />
          </div>

          <p className="mt-8 hidden text-xs text-slate-500 md:block">
            Secure access for shop owners and their teams
          </p>
        </div>

        <div className="signin-glow order-1 w-full max-w-md md:order-2 md:max-w-none">
        <section className="relative z-10 w-full rounded-[1.5rem] border border-white/15 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:rounded-[2rem] sm:p-8">
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Welcome back</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Sign in to StockFlow</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Use your shop account to continue.</p>
          </div>

          {notice ? (
            <p role="alert" className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-100">
              {notice}
            </p>
          ) : null}

          <LoginForm blocked={blockedRole} />

          <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-white/10" />
            <span>Protected shop access</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </section>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 pb-5 text-center text-xs text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between md:text-left lg:px-10">
        <p>StockFlow · Inventory and sales management</p>
        <Credit />
      </footer>
    </main>
  );
}

function Feature({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 backdrop-blur-sm">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}
