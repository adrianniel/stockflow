"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  FILTER_LABELS,
  MAX_RANGE_DAYS,
  PRESET_LABELS,
  RANGE_PRESETS,
  SALE_FILTERS,
  reportHref,
  type ReportRange,
  type SaleFilter,
} from "@/lib/shop/report-range";
import { cn } from "@/lib/utils/cn";

/**
 * Range and status controls for the reports page.
 *
 * Navigates rather than fetching: the range lives in the URL, so the server
 * component re-runs with new searchParams, the report stays bookmarkable and
 * shareable, and the back button steps through ranges the way it should. That is
 * also why the presets are links in spirit — they are rendered as buttons only
 * so the active one can be styled and the custom dates can be pushed from the
 * same place.
 *
 * The custom dates are local state until Apply, so a half-entered range never
 * triggers a query. `from` alone is not a range.
 */
export function ReportFilters({ range }: { range: ReportRange }) {
  const router = useRouter();
  const [fromKey, setFromKey] = useState(range.fromKey);
  const [toKey, setToKey] = useState(range.toKey);

  function go(href: string) {
    router.push(href);
  }

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.filter((preset) => preset !== "custom").map((preset) => (
          <Button
            key={preset}
            type="button"
            variant={range.preset === preset ? "primary" : "secondary"}
            size="sm"
            onClick={() => go(reportHref({ preset, filter: range.filter }))}
          >
            {PRESET_LABELS[preset]}
          </Button>
        ))}

        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium",
            range.preset === "custom"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 text-slate-500",
          )}
        >
          {PRESET_LABELS.custom}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <Field label="From" htmlFor="report-from">
          <Input
            id="report-from"
            type="date"
            value={fromKey}
            max={toKey}
            onChange={(event) => setFromKey(event.target.value)}
          />
        </Field>

        <Field label="To" htmlFor="report-to">
          <Input
            id="report-to"
            type="date"
            value={toKey}
            min={fromKey}
            onChange={(event) => setToKey(event.target.value)}
          />
        </Field>

        <Field
          label="Sales shown"
          htmlFor="report-filter"
          hint="Collections are never filtered — a payment has no status of its own."
        >
          <Select
            id="report-filter"
            value={range.filter}
            onChange={(event) => {
              const filter = event.target.value as SaleFilter;

              // Carries the current range across, so changing the status filter
              // does not silently reset the dates.
              go(
                reportHref({
                  preset: range.preset,
                  fromKey: range.fromKey,
                  toKey: range.toKey,
                  filter,
                }),
              );
            }}
          >
            {SALE_FILTERS.map((filter) => (
              <option key={filter} value={filter}>
                {FILTER_LABELS[filter]}
              </option>
            ))}
          </Select>
        </Field>

        <Button
          type="button"
          variant="secondary"
          // An incomplete pair is not a range, and the server would fall back to
          // the default rather than honour it — so the button says so instead.
          disabled={fromKey === "" || toKey === ""}
          onClick={() =>
            go(
              reportHref({
                preset: "custom",
                fromKey,
                toKey,
                filter: range.filter,
              }),
            )
          }
        >
          Apply dates
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        Ranges are limited to {MAX_RANGE_DAYS} days so totals stay accurate.
      </p>
    </div>
  );
}
