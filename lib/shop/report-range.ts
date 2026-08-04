/**
 * Date ranges for the reports page.
 *
 * Kept apart from reports.ts because this is parsing and validation of what the
 * URL asked for, while reports.ts is the querying. The split matters for one
 * reason in particular: the range is the only user-controlled input to an
 * unbounded query, so the cap enforced here is what keeps the report honest.
 *
 * Every date is handled in the server's local timezone, matching reports.ts —
 * "today" belongs to the shop's own day, not to UTC.
 */

/**
 * The longest range the reports page will aggregate.
 *
 * This is not a UI preference, it is a correctness limit. Sales are summed in
 * Node from rows fetched through PostgREST, which caps responses at `max_rows`
 * (1000, set in supabase/config.toml). A range wide enough to exceed that would
 * not error — it would silently return a truncated set and report totals that
 * are quietly too low. Capping the range keeps the row count comfortably under
 * that ceiling for a small shop; loadSales() also asserts it was not truncated,
 * so if this assumption is ever wrong the page fails loudly instead of lying.
 *
 * 92 days covers a full quarter, which is the longest window these reports are
 * meaningfully used for. Anything longer wants SQL-side aggregation.
 */
export const MAX_RANGE_DAYS = 92;

export const RANGE_PRESETS = ["today", "7d", "30d", "month", "custom"] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  custom: "Custom",
};

/**
 * Which sales to count. Collections are never filtered by this — a payment is
 * not a sale, and its parent's status changes as it is paid off.
 */
export const SALE_FILTERS = ["all", "PAID", "PARTIAL", "CREDIT"] as const;

export type SaleFilter = (typeof SALE_FILTERS)[number];

export const FILTER_LABELS: Record<SaleFilter, string> = {
  all: "All sales",
  PAID: "Paid in full",
  PARTIAL: "Partially paid",
  CREDIT: "Credit (unpaid)",
};

export type ReportRange = {
  /** Inclusive start, at local midnight. */
  from: Date;
  /** Exclusive end, at local midnight — the day after the last day shown. */
  to: Date;
  /** Inclusive start as YYYY-MM-DD, for form values and links. */
  fromKey: string;
  /** Inclusive *last day* as YYYY-MM-DD. Not the same as `to`. */
  toKey: string;
  preset: RangePreset;
  filter: SaleFilter;
  /**
   * Days the request asked for when that exceeded MAX_RANGE_DAYS, else null.
   * The page shows this so a shortened range is never silently substituted for
   * the one that was asked for.
   */
  requestedDays: number | null;
};

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);

  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);

  return copy;
}

/** Local calendar date as YYYY-MM-DD. The key sales and payments bucket by. */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Parses YYYY-MM-DD as a *local* midnight.
 *
 * `new Date("2026-08-05")` is not this: the spec parses a date-only string as
 * UTC, so in any timezone behind UTC it lands on the previous evening and the
 * day renders off by one. Passing the parts separately avoids that, which
 * matters because these keys travel in URLs and have to round-trip.
 *
 * Returns null for anything malformed or non-existent (2026-02-30), rather than
 * the silent rollover the Date constructor would perform.
 */
export function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  // A rolled-over date (Feb 30 -> Mar 2) no longer matches its own parts.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return startOfDay(date);
}

/** Whole days between two local midnights. Rounded, so DST shifts don't skew it. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function isPreset(value: string | undefined): value is RangePreset {
  return value !== undefined && (RANGE_PRESETS as readonly string[]).includes(value);
}

function isFilter(value: string | undefined): value is SaleFilter {
  return value !== undefined && (SALE_FILTERS as readonly string[]).includes(value);
}

export type ReportSearchParams = {
  preset?: string;
  from?: string;
  to?: string;
  filter?: string;
};

/**
 * Turns the URL's query into a validated range.
 *
 * Anything unparseable falls back to the default rather than erroring: a
 * hand-edited or stale URL should show a usable report, not a crash. The one
 * thing never silently adjusted is a range that is too long — that is reported
 * through `requestedDays` so the page can say what it did.
 */
export function parseReportRange(
  params: ReportSearchParams,
  now: Date = new Date(),
): ReportRange {
  const today = startOfDay(now);
  const filter: SaleFilter = isFilter(params.filter) ? params.filter : "all";

  const requestedFrom = params.from ? parseDateKey(params.from) : null;
  const requestedTo = params.to ? parseDateKey(params.to) : null;

  // An explicit from/to pair is treated as custom even without preset=custom,
  // so a shared link carrying only dates still resolves to those dates.
  const preset: RangePreset = isPreset(params.preset)
    ? params.preset
    : requestedFrom && requestedTo
      ? "custom"
      : "7d";

  let from: Date;
  let lastDay: Date;

  switch (preset) {
    case "today":
      from = today;
      lastDay = today;
      break;

    case "30d":
      // Inclusive of today, so 30 days back is 29 days before it.
      from = addDays(today, -29);
      lastDay = today;
      break;

    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      lastDay = today;
      break;

    case "custom":
      if (requestedFrom && requestedTo) {
        // Reversed dates are swapped rather than rejected; the intent is clear.
        from = requestedFrom <= requestedTo ? requestedFrom : requestedTo;
        lastDay = requestedFrom <= requestedTo ? requestedTo : requestedFrom;
      } else {
        from = addDays(today, -6);
        lastDay = today;
      }
      break;

    case "7d":
    default:
      from = addDays(today, -6);
      lastDay = today;
      break;
  }

  const requested = daysBetween(from, lastDay) + 1;
  let requestedDays: number | null = null;

  if (requested > MAX_RANGE_DAYS) {
    requestedDays = requested;

    // The most recent days are kept: someone asking for two years of history
    // is looking for the recent end of it, and a report that silently dropped
    // the newest data would be the more surprising outcome.
    from = addDays(lastDay, -(MAX_RANGE_DAYS - 1));
  }

  return {
    from,
    to: addDays(lastDay, 1),
    fromKey: dateKey(from),
    toKey: dateKey(lastDay),
    preset,
    filter,
    requestedDays,
  };
}

/** Builds a reports URL, used for the preset buttons and day links. */
export function reportHref(range: {
  preset: RangePreset;
  fromKey?: string;
  toKey?: string;
  filter: SaleFilter;
}): string {
  const params = new URLSearchParams();

  params.set("preset", range.preset);

  if (range.preset === "custom" && range.fromKey && range.toKey) {
    params.set("from", range.fromKey);
    params.set("to", range.toKey);
  }

  if (range.filter !== "all") {
    params.set("filter", range.filter);
  }

  return `/dashboard/reports?${params.toString()}`;
}
