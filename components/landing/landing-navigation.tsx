"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const links = [
  { label: "Sign in", href: "#signin" },
  { label: "About", href: "#about" },
  { label: "Features", href: "#features" },
  { label: "Contact", href: "#contact" },
];

export function LandingNavigation() {
  const [open, setOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#signin");
  const menuRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Follow visual document order rather than menu order, so the highlighted
    // destination consistently tracks the section currently being read.
    const sectionIds = ["#signin", "#features", "#about", "#contact"];
    let scheduled = false;

    function updateActiveSection() {
      const readingLine = window.scrollY + Math.min(window.innerHeight * 0.3, 240);
      let current = "#signin";

      for (const id of sectionIds) {
        const section = document.querySelector(id);
        if (section && section.getBoundingClientRect().top + window.scrollY <= readingLine) {
          current = id;
        }
      }

      setActiveHref(current);
      scheduled = false;
    }

    function onScroll() {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(updateActiveSection);
      }
    }

    updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const duration = reduceMotion ? 0 : 0.32;
  const activeLabel = links.find((link) => link.href === activeHref)?.label ?? "Sign in";

  return (
    <div ref={menuRef} className="fixed right-4 top-4 z-[60] sm:right-7 xl:right-[calc((100vw-80rem)/2+2.5rem)]">
      <motion.button
        type="button"
        aria-label={`${activeLabel}; ${open ? "close" : "open"} navigation menu`}
        aria-expanded={open}
        aria-controls="landing-navigation-menu"
        onClick={() => setOpen((value) => !value)}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        className="relative flex h-12 min-w-12 items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white/[0.1] px-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.16)] backdrop-blur-2xl transition-colors hover:bg-white/[0.17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-200 sm:px-4"
      >
        <span className="max-w-28 truncate text-xs font-bold tracking-wide text-white sm:text-sm">
          {activeLabel}
        </span>
        <span aria-hidden="true" className="h-5 w-px bg-white/20" />
        <span aria-hidden="true" className="flex w-5 flex-col gap-[5px]">
          <motion.span
            className="h-[1.5px] w-5 rounded-full bg-current"
            animate={{ y: open ? 6.5 : 0, rotate: open ? 45 : 0 }}
            transition={{ duration }}
          />
          <motion.span
            className="h-[1.5px] w-5 rounded-full bg-current"
            animate={{ opacity: open ? 0 : 1, scaleX: open ? 0.5 : 1 }}
            transition={{ duration }}
          />
          <motion.span
            className="h-[1.5px] w-5 rounded-full bg-current"
            animate={{ y: open ? -6.5 : 0, rotate: open ? -45 : 0 }}
            transition={{ duration }}
          />
        </span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.nav
            id="landing-navigation-menu"
            aria-label="Main navigation"
            initial={reduceMotion ? false : { opacity: 0, height: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, height: "auto", y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, height: 0, y: -6, scale: 0.98 }}
            transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
            className="liquid-nav-menu absolute right-0 top-[calc(100%+0.75rem)] w-[min(18rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-[1.65rem] border border-white/25 p-2.5 shadow-[0_24px_80px_rgba(0,0,0,0.3)]"
          >
            <div className="rounded-[1.1rem] border border-white/10 bg-slate-950/20 p-1.5">
              {links.map((link, index) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  aria-current={activeHref === link.href ? "location" : undefined}
                  onClick={() => {
                    setActiveHref(link.href);
                    setOpen(false);
                  }}
                  initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration, delay: reduceMotion ? 0 : index * 0.035 }}
                  className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-200 ${
                    activeHref === link.href
                      ? "bg-white/[0.22] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] hover:bg-white/[0.28]"
                      : "font-medium text-blue-50/85 hover:bg-white/[0.12] hover:text-white"
                  }`}
                >
                  <span>{link.label}</span>
                  <span aria-hidden="true" className={activeHref === link.href ? "text-blue-200" : "text-white/45"}>
                    {activeHref === link.href ? "●" : "↗"}
                  </span>
                </motion.a>
              ))}
            </div>
            <p className="px-4 pb-1 pt-3 text-[0.65rem] font-medium tracking-wide text-white/55">
              StockFlow · Inventory, clearly managed
            </p>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
