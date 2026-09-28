"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { CURRENT_RELEASE } from "@/lib/updates/current-release";

type AnnouncementAudience = "landing" | "account";

const MAX_SHOW_DAYS = 5;
const STORAGE_PREFIX = "stockflow-update-announcement";

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function UpdateAnnouncement({ audience }: { audience: AnnouncementAudience }) {
  const [visible, setVisible] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const campaignStartKey = `${STORAGE_PREFIX}:${CURRENT_RELEASE.id}:first-shown`;
  const permanentDismissalKey = `${STORAGE_PREFIX}:${CURRENT_RELEASE.id}:dismissed`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = localDateKey();

      try {
        if (window.localStorage.getItem(permanentDismissalKey) === "true") return;

        let campaignStart = window.localStorage.getItem(campaignStartKey);
        if (!campaignStart) {
          campaignStart = today;
          window.localStorage.setItem(campaignStartKey, campaignStart);
        }

        const elapsedDays = calendarDayNumber(today) - calendarDayNumber(campaignStart);
        if (elapsedDays >= MAX_SHOW_DAYS) return;
        if (elapsedDays < 0) {
          campaignStart = today;
          window.localStorage.setItem(campaignStartKey, today);
        }
      } catch {
        // Storage may be unavailable in private browsing. Still show the news
        // for this visit; the close button remains usable for the current mount.
      }

      setVisible(true);
      window.setTimeout(() => closeRef.current?.focus(), 80);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [campaignStartKey, permanentDismissalKey]);

  useEffect(() => {
    if (!visible) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setVisible(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = priorOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible]);

  function dismissPermanently() {
    try {
      window.localStorage.setItem(permanentDismissalKey, "true");
    } catch {
      // Closing still works when browser storage is disabled.
    }
    setVisible(false);
  }

  const content = CURRENT_RELEASE[audience];
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#041026]/75 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setVisible(false);
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="release-announcement-title"
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
            transition={transition}
            className="relative my-auto w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#07152e] text-white shadow-[0_32px_100px_rgba(0,0,0,0.45)] sm:rounded-[2rem]"
          >
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
              <div className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl" />
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.07),transparent_44%)]" />
            </div>

            <div className="relative p-5 sm:p-8">
              <button
                ref={closeRef}
                type="button"
                aria-label="Close announcement"
                title="Close announcement"
                onClick={() => setVisible(false)}
                className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-xl border border-white/15 bg-white/[0.08] text-slate-200 transition hover:bg-white/[0.16] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 sm:right-6 sm:top-6"
              >
                <CloseIcon />
              </button>

              <p className="inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-blue-300/10 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-blue-200 sm:text-xs">
                <SparkleIcon />
                StockFlow release update
              </p>
              <h2 id="release-announcement-title" className="mt-5 pr-10 text-2xl font-semibold leading-tight tracking-tight sm:mt-6 sm:text-3xl">
                {CURRENT_RELEASE.title}
              </h2>
              <p className="mt-2 text-sm font-semibold text-blue-100">What’s new?</p>
              <p className="mt-4 text-sm leading-6 text-slate-200 sm:text-[0.95rem] sm:leading-7">
                {content.intro}
              </p>

              <ul className="mt-5 space-y-3">
                {content.changes.map((change) => (
                  <li key={change} className="flex gap-3 text-sm leading-6 text-slate-100">
                    <span aria-hidden="true" className="mt-2 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-blue-400/20 text-blue-200">
                      <CheckIcon />
                    </span>
                    <span>{change}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-6 text-slate-200">
                {content.closing}
              </p>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={dismissPermanently}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300 sm:text-sm"
                >
                  Don’t show this again
                </button>
                {audience === "landing" ? (
                  <a
                    href="#signin"
                    onClick={() => setVisible(false)}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(59,130,246,0.25)] transition hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-200"
                  >
                    Explore StockFlow
                  </a>
                ) : null}
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path d="m10 1 1.7 6.3L18 9l-6.3 1.7L10 17l-1.7-6.3L2 9l6.3-1.7L10 1Zm6.5 11.5.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
      <path d="m3.5 8 3 3 6-6" />
    </svg>
  );
}
