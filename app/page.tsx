import Image from "next/image";
import { redirect } from "next/navigation";

import { Credit } from "@/components/ui/credit";
import { Logo } from "@/components/ui/logo";
import { getCurrentUser } from "@/lib/supabase/auth.server";
import { WorkflowStepper } from "@/components/landing/workflow-stepper";

import { LoginForm } from "./login/login-form";

const CONTACT_EMAIL = "adrianniel.garig@gmail.com";

export const metadata = {
  title: { absolute: "StockFlow — Inventory and sales management" },
};

const NOTICES: Record<string, string> = {
  account:
    "This account has been deactivated. Ask the shop owner to reactivate it, or sign in with a different account.",
  shop: "This shop is currently inactive. Contact StockFlow support to have it reactivated.",
};

const workflows = [
  {
    number: "01",
    title: "Set up your shop and team",
    description:
      "A shop owner signs in and manages their workspace. Owners can invite up to two assistants for everyday shop operations.",
    detail: "Separate shop workspaces · Owner and assistant roles",
  },
  {
    number: "02",
    title: "Organize your products",
    description:
      "Create categories and product records with names, brands, and descriptions. Product identity stays separate from changing purchase prices.",
    detail: "Products · Categories · Searchable catalogue",
  },
  {
    number: "03",
    title: "Receive stock by batch",
    description:
      "Record each arrival with its own reference, date, quantity, capital cost, and selling price. New supplier costs never overwrite older batches.",
    detail: "Batch history · Markup settings · Current stock value",
  },
  {
    number: "04",
    title: "Record sales with accurate costs",
    description:
      "Build a sale from available products, use FIFO or select a specific batch, adjust the selling price, and record a paid, partial, or credit sale.",
    detail: "FIFO stock deduction · Batch selection · Discounts",
  },
  {
    number: "05",
    title: "Track customers and collections",
    description:
      "Attach credit and partial sales to customers, then record later payments with their actual collection date and time.",
    detail: "Customer balances · Payment history · Collection dates",
  },
  {
    number: "06",
    title: "Record shop expenses",
    description:
      "Add operating expenses for today or a past date. Edit or soft-delete a mistake; active expenses reduce that day’s net profit.",
    detail: "Daily expenses · Optional notes · Net profit",
  },
  {
    number: "07",
    title: "Correct and protect your records",
    description:
      "Owners can amend or void a wrongly recorded sale with a reason. Stock is restored to the original batches and history stays auditable.",
    detail: "Sale amendments · Sale voids · Stock adjustments",
  },
  {
    number: "08",
    title: "Review performance and export reports",
    description:
      "Check dashboard summaries, daily details, date-range sales and net profit, best sellers, and collections. Export daily, weekly, or monthly PDFs.",
    detail: "Daily, weekly, monthly · Net profit · PDF export",
  },
];

const capabilities = [
  {
    title: "Inventory with price history",
    description:
      "Each delivery remains its own batch, preserving its cost, suggested selling price, arrival date, and remaining quantity.",
  },
  {
    title: "Sales built around real stock",
    description:
      "FIFO is the default, with optional manual batch selection. Sales can use adjusted prices and split payments or customer credit.",
  },
  {
    title: "Profit that reflects the transaction",
    description:
      "Sales profit uses actual selling prices and the cost of the batches sold. Active expenses are deducted to show net profit.",
  },
  {
    title: "A useful record of corrections",
    description:
      "Voided sales, amended sales, stock adjustments, and soft-deleted expenses retain their history instead of silently disappearing.",
  },
  {
    title: "Reports for everyday decisions",
    description:
      "See revenue, cost, sales profit, expenses, net profit, collections, outstanding credit, inventory, and top products.",
  },
  {
    title: "Separate access for every shop",
    description:
      "Shop records are scoped to that shop. Owners manage the business and team; assistants can help with daily tasks and expenses.",
  },
];

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
  const registrationHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("StockFlow shop registration")}`;

  return (
    <main className="bg-[#f6f8fc] text-slate-950">
      <div className="relative isolate overflow-hidden bg-[#07152e] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <Image
            src="/landing.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-[#07152e]/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#07152e]/25 via-[#07152e]/35 to-[#07152e]/85" />
        </div>

        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07152e]/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-7 md:flex-row md:items-center md:justify-between lg:px-10">
            <a href="#home" className="flex w-fit items-center gap-3" aria-label="StockFlow home">
              <Logo size="sm" priority />
              <span>
                <span className="block text-sm font-semibold tracking-tight text-white">StockFlow</span>
                <span className="block text-xs text-slate-400">Inventory, clearly managed.</span>
              </span>
            </a>

            <nav aria-label="Main navigation" className="flex items-center justify-between gap-2 overflow-x-auto text-xs font-medium sm:gap-5 sm:text-sm md:justify-end">
              <a className="whitespace-nowrap text-slate-300 transition hover:text-white" href="#about">About</a>
              <a className="whitespace-nowrap text-slate-300 transition hover:text-white" href="#features">Features</a>
              <a className="whitespace-nowrap text-slate-300 transition hover:text-white" href="#contact">Contact</a>
              <a className="whitespace-nowrap rounded-xl border border-blue-300/30 bg-blue-400/15 px-3 py-2 text-blue-100 transition hover:bg-blue-400/25 sm:px-4" href="#signin">Sign in</a>
            </nav>
          </div>
        </header>

        <section id="home" className="mx-auto grid min-h-[calc(100svh-76px)] w-full max-w-7xl items-center gap-8 px-4 py-8 sm:px-7 sm:py-12 md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(370px,440px)] lg:px-10">
          <div className="order-2 max-w-2xl md:order-1">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-blue-200 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.9)]" />
              Inventory that adds up
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:mt-6 sm:text-5xl lg:text-6xl">
              Know your stock.
              <span className="block text-blue-300">Know your profit.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-200 sm:mt-6 sm:text-lg sm:leading-8">
              StockFlow brings your products, batch-based inventory, sales,
              customer credit, expenses, and reports into one practical system
              for running your shop.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a href={registrationHref} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-blue-950/20 transition hover:bg-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-200">
                Register your shop
              </a>
              <a href="#features" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                Explore features
              </a>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-300">
              Interested in joining StockFlow? Email{" "}
              <a className="font-medium text-blue-200 underline decoration-blue-200/40 underline-offset-4 hover:text-white" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              to ask about registering your shop.
            </p>
          </div>

          <div id="signin" className="signin-glow order-1 mx-auto w-full max-w-md rounded-[1.5rem] md:order-2 md:max-w-none sm:rounded-[2rem]">
            <section aria-labelledby="signin-title" className="relative z-10 w-full rounded-[1.5rem] border border-white/15 bg-slate-950/85 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:rounded-[2rem] sm:p-8">
              <div className="mb-6 sm:mb-7">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Welcome back</p>
                <h2 id="signin-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">Sign in to StockFlow</h2>
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
      </div>

      <section id="features" className="scroll-mt-24 px-4 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="From setup to reporting"
            title="A complete shop workflow, in one place."
            description="See how StockFlow supports the day-to-day work of a shop, from adding products and receiving stock to recording sales and reviewing net profit."
          />

          <WorkflowStepper steps={workflows} />

          <div className="mt-14 rounded-[2rem] bg-slate-950 px-5 py-8 text-white sm:px-8 sm:py-10 lg:px-12">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">What StockFlow helps you manage</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">The tools behind the workflow</h3>
            </div>
            <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item) => (
                <article key={item.title} className="border-t border-white/15 pt-4">
                  <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-7 sm:pb-20 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-6 sm:p-9 md:flex-row md:items-center md:justify-between lg:p-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">For shop owners</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Want to bring your shop onto StockFlow?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              Tell me a little about your business and what you need from an
              inventory system. Get in touch to discuss registering your shop.
            </p>
          </div>
          <a href={registrationHref} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Email to register
          </a>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 border-y border-slate-200 bg-white px-4 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="About StockFlow"
            title="A clearer way to run shop inventory and understand profit."
            description="StockFlow is an inventory and profit management system for small businesses. It was designed around the real work of shops that need to track changing purchase costs, stock movement, sales, and daily operating expenses without losing the history behind their numbers."
          />
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <AboutCard title="Keep each stock arrival clear" text="Products describe what an item is. Batches record what each arrival cost, when it came in, and how many units are still available." />
            <AboutCard title="Record what really happened" text="Sales preserve actual prices and the batches they used. Payments, corrections, and expenses remain part of an understandable business history." />
            <AboutCard title="Understand shop performance" text="Dashboards and reports bring together sales, stock, customer balances, collections, expenses, and net profit for the dates that matter." />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.08)] md:grid-cols-[0.85fr_1.15fr]">
          <div className="relative min-h-[320px] bg-slate-200 sm:min-h-[420px] md:min-h-full">
            <Image
              src="/creator_Niel%20Adrian.jpg"
              alt="Niel Adrian Garig, creator of StockFlow"
              fill
              sizes="(max-width: 768px) 100vw, 40vw"
              className="object-cover object-[center_35%]"
            />
          </div>
          <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Meet the creator</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Niel Adrian Garig</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">Computer Science student · BISU Bilar Campus</p>
            <div className="mt-6 space-y-4 text-sm leading-7 text-slate-600 sm:text-base">
              <p>
                I’m taking a Bachelor of Science in Computer Science at Bohol
                Island State University, Bilar Campus. I enjoy building useful
                systems that solve practical problems and make everyday work
                clearer for the people who rely on them.
              </p>
              <p>
                StockFlow grew from that interest: helping shop owners keep
                inventory, sales, and profit records organized and easier to
                understand. I’m always interested in learning how technology
                can support local businesses and their day-to-day operations.
              </p>
              <p>
                If you need a system for your business or would like to discuss
                bringing your shop onto StockFlow, I’d be glad to talk.
              </p>
            </div>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-7 inline-flex min-h-12 w-fit items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-blue-200 hover:bg-blue-50">
              Contact me: {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </section>

      <section id="contact" className="scroll-mt-24 bg-[#07152e] px-4 py-12 text-white sm:px-7 sm:py-14 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Contact and shop registration</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Let’s talk about what your shop needs.</h2>
            <a className="mt-2 inline-block break-all text-sm text-blue-200 underline decoration-blue-200/40 underline-offset-4 hover:text-white" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </div>
          <a href={registrationHref} className="inline-flex min-h-12 w-fit shrink-0 items-center justify-center rounded-2xl bg-blue-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-300">
            Ask about registering
          </a>
        </div>
      </section>

      <footer className="flex flex-col gap-2 bg-[#07152e] px-4 pb-5 text-center text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:text-left lg:px-10">
        <p>StockFlow · Inventory and sales management</p>
        <Credit />
      </footer>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
    </div>
  );
}

function AboutCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
      <h3 className="text-base font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}
