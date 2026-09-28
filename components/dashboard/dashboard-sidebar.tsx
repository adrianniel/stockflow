"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { LogoutButton } from "@/components/dashboard/logout-button";
import { Logo } from "@/components/ui/logo";
import type { NavItem, SessionProfile } from "@/lib/auth/roles";

type DashboardSidebarProps = {
  items: NavItem[];
  profile: SessionProfile;
};

const ROLE_NAMES: Record<SessionProfile["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Shop Owner",
  ASSISTANT: "Assistant",
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Fixed StockFlow identity bar and role-filtered navigation drawer. */
export function DashboardSidebar({ items, profile }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shopRole = profile.shop_name
    ? `${profile.shop_name} · ${ROLE_NAMES[profile.role]}`
    : ROLE_NAMES[profile.role];

  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#07152e]/95 text-white shadow-[0_8px_32px_rgba(7,21,46,0.2)] backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-8">
          <Link
            href="/dashboard"
            className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-300"
          >
            <Logo size="md" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-white sm:text-base">StockFlow</span>
              <span
                title={shopRole}
                className="block max-w-[min(70vw,28rem)] truncate text-[0.65rem] font-medium uppercase tracking-[0.1em] text-blue-100/75 sm:text-xs"
              >
                {shopRole}
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="dashboard-navigation"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/[0.08] text-white transition hover:border-white/30 hover:bg-white/[0.15] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-[#07152e]/45 backdrop-blur-[2px]"
            />

            <motion.aside
              id="dashboard-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard navigation"
              initial={{ x: "-100%", opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0.8 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute bottom-0 left-0 top-[76px] flex w-[min(21rem,88vw)] flex-col border-r border-slate-200/80 bg-[#f4ecdf] p-4 shadow-[0_25px_80px_rgba(7,21,46,0.25)] sm:p-5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-300/70 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-800">Navigation</p>
                  <p className="mt-1 max-w-[15rem] truncate text-xs text-slate-600">{shopRole}</p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation menu"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-300/80 bg-white/60 text-slate-700 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  <CloseIcon />
                </button>
              </div>

              <nav aria-label="Dashboard" className="mt-4 space-y-1 overflow-y-auto">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-[#07152e] text-white shadow-sm"
                          : "text-slate-700 hover:bg-white/75 hover:text-slate-950"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto border-t border-slate-300/70 pt-4">
                <LogoutButton />
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
