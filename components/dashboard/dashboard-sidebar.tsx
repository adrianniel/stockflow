"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LogoutButton } from "@/components/dashboard/logout-button";
import { Logo, Wordmark } from "@/components/ui/logo";
import type { NavItem, SessionProfile } from "@/lib/auth/roles";

type DashboardSidebarProps = {
  items: NavItem[];
  profile: SessionProfile;
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Navigation for every dashboard page, in two forms.
 *
 * On `md` and up this is the fixed left sidebar. Below that the same links move
 * into a slide-over drawer behind a top bar, because an owner has nine of them —
 * rendered inline on a phone they would fill the screen and push the page's own
 * content below the fold. Both forms are built from the shared Brand/NavLinks
 * pieces so a link only ever has to be added in one place.
 */
export function DashboardSidebar({ items, profile }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Tapping a link navigates but does not unmount this component, so the drawer
  // has to be dismissed on every route change. Adjusting during render rather
  // than from an effect avoids painting the open drawer over the new page for a
  // frame first, and keying off the path covers the back button and any redirect
  // a page performs, not just link taps.
  if (openedAt !== pathname) {
    setOpenedAt(pathname);

    if (open) {
      setOpen(false);
    }
  }

  // While the drawer covers the screen, the page behind it must not scroll —
  // otherwise dragging on the backdrop moves the content underneath.
  useEffect(() => {
    if (!open) {
      return;
    }

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Focus starts inside the drawer so the keyboard and screen reader follow
    // it open, and Escape closes it the way a dialog is expected to.
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const activeItem = items.find((item) => isActive(pathname, item.href));

  return (
    <>
      {/*
        The mobile bar is full-bleed and sticky so it behaves like an app header
        rather than a card that scrolls away. The layout drops its top padding
        below `md` to let this sit flush against the top edge.
      */}
      <div className="sticky top-0 z-30 -mx-4 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <Logo size="sm" />

        <div className="min-w-0 flex-1">
          <p
            title={profile.shop_name ?? "StockFlow"}
            className="truncate text-sm font-semibold tracking-tight text-slate-950"
          >
            {profile.shop_name ?? "StockFlow"}
          </p>
          {activeItem ? (
            <p className="truncate text-xs text-slate-500">{activeItem.label}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open navigation menu"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <MenuIcon />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          {/*
            A button rather than a div so dismissing by tapping outside is
            reachable by keyboard and announced, instead of being a click
            handler on decoration.
          */}
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dashboard navigation"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col bg-white p-4 shadow-[0_30px_80px_rgba(15,23,42,0.35)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <Brand profile={profile} />

              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                <CloseIcon />
              </button>
            </div>

            <NavLinks items={items} pathname={pathname} className="mt-5" />

            <div className="mt-auto pt-6">
              <LogoutButton />
            </div>
          </div>
        </div>
      ) : null}

      <aside className="hidden flex-col rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:sticky md:top-6 md:flex md:h-[calc(100vh-3rem)] md:w-[280px] md:shrink-0 md:p-5">
        <div className="border-b border-slate-200 pb-5">
          <Brand profile={profile} />
        </div>

        <NavLinks items={items} pathname={pathname} className="mt-6 overflow-y-auto" />

        <div className="mt-auto pt-6">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}

/**
 * For a shop member the store's own name is the identity of this space, so it
 * takes the primary line and StockFlow steps back to the tagline. SUPER_ADMIN
 * belongs to no shop and keeps the product branding.
 */
function Brand({ profile }: { profile: SessionProfile }) {
  if (!profile.shop_name) {
    return <Wordmark tagline="Inventory management" />;
  }

  return (
    <div className="flex items-center gap-3">
      <Logo size="md" />
      <div className="min-w-0">
        <p
          title={profile.shop_name}
          className="truncate text-sm font-semibold tracking-tight text-slate-950"
        >
          {profile.shop_name}
        </p>
        <p className="truncate text-xs text-slate-500">StockFlow</p>
      </div>
    </div>
  );
}

function NavLinks({
  items,
  pathname,
  className,
}: {
  items: NavItem[];
  pathname: string;
  className?: string;
}) {
  return (
    <nav aria-label="Dashboard" className={`space-y-1 ${className ?? ""}`}>
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
              active
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="h-4 w-4"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
