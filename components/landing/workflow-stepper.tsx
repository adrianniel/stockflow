"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export type WorkflowStep = {
  number: string;
  title: string;
  description: string;
  detail: string;
};

export function WorkflowStepper({ steps }: { steps: WorkflowStep[] }) {
  const [activeStep, setActiveStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [complete, setComplete] = useState(false);

  function goToStep(nextStep: number) {
    setDirection(nextStep >= activeStep ? 1 : -1);
    setActiveStep(nextStep);
    setComplete(false);
  }

  function goNext() {
    if (activeStep === steps.length - 1) {
      setComplete(true);
      return;
    }
    goToStep(activeStep + 1);
  }

  function goBack() {
    if (complete) {
      setComplete(false);
      return;
    }
    goToStep(Math.max(activeStep - 1, 0));
  }

  const current = steps[activeStep];

  return (
    <div className="mt-9 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_20px_65px_rgba(15,23,42,0.08)] sm:mt-10 sm:rounded-[2rem]">
      <div className="flex flex-col items-stretch gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-7 sm:py-5">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          {complete ? "Flow complete" : `Step ${activeStep + 1} of ${steps.length}`}
        </p>
        <div className="flex w-full min-w-0 items-center justify-between gap-1 sm:w-auto sm:flex-1 sm:justify-end sm:gap-1.5" aria-label="Workflow steps">
          {steps.map((step, index) => {
            const isDone = complete || index < activeStep;
            const isCurrent = !complete && index === activeStep;

            return (
              <div key={step.number} className="flex min-w-0 items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => goToStep(index)}
                  aria-label={`Go to step ${index + 1}: ${step.title}`}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.65rem] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:h-8 sm:w-8 sm:text-xs ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : isDone
                        ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {isDone ? <CheckIcon /> : index + 1}
                </button>
                {index < steps.length - 1 ? (
                  <span className={`hidden h-0.5 w-2 rounded-full sm:block sm:w-3 ${index < activeStep || complete ? "bg-blue-300" : "bg-slate-200"}`} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[17rem] overflow-hidden px-5 py-6 sm:min-h-[15rem] sm:px-7 sm:py-8">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          {complete ? (
            <motion.div
              key="complete"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex min-h-[13rem] flex-col justify-center"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckIcon large />
              </span>
              <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                That’s the StockFlow workflow.
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                From receiving a batch to reviewing net profit, the key records
                stay connected and easy to follow.
              </p>
            </motion.div>
          ) : current ? (
            <motion.article
              key={current.number}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.32, ease: "easeOut" }}
              className="flex min-h-[13rem] flex-col justify-center"
              aria-live="polite"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Workflow {current.number}
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                {current.title}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                {current.description}
              </p>
              <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-semibold leading-5 text-slate-500 sm:text-sm">
                {current.detail}
              </p>
            </motion.article>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 sm:px-7">
        <button
          type="button"
          onClick={goBack}
          disabled={activeStep === 0 && !complete}
          className="min-h-10 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:pointer-events-none disabled:opacity-0"
        >
          Back
        </button>
        <button
          type="button"
          onClick={complete ? () => goToStep(0) : goNext}
          className="min-h-11 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {complete ? "Start again" : activeStep === steps.length - 1 ? "Complete" : "Next"}
        </button>
      </div>
    </div>
  );
}

function CheckIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={large ? "h-6 w-6" : "h-4 w-4"}
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

const slideVariants = {
  enter: (direction: number) => ({ x: direction >= 0 ? "-12%" : "12%", opacity: 0 }),
  center: { x: "0%", opacity: 1 },
  exit: (direction: number) => ({ x: direction >= 0 ? "12%" : "-12%", opacity: 0 }),
};
