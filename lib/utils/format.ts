/**
 * Display formatting for money, quantities, and dates.
 *
 * Money is formatted in PHP because StockFlow targets small Philippine auto
 * parts shops. Amounts arrive from Postgres `numeric` columns, which
 * supabase-js returns as strings to avoid float rounding — so every helper
 * accepts `string | number` and normalizes once, here, rather than at each
 * call site.
 */

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const decimal = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});

const dateOnly = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateAndTime = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrency(value: string | number | null | undefined) {
  return currency.format(toNumber(value));
}

export function formatNumber(value: string | number | null | undefined) {
  return decimal.format(toNumber(value));
}

/**
 * Renders a stored percentage as a label: 30 -> "30%".
 *
 * `stock_batches.interest_percentage` stores whole percentage points (its
 * column default is 30.00, meaning 30%), not a 0-1 fraction, so this does not
 * multiply. Keep that in mind when computing a selling price: the multiplier is
 * `1 + interest / 100`.
 */
export function formatPercent(value: string | number | null | undefined) {
  return `${decimal.format(toNumber(value))}%`;
}

/**
 * Selling price derived from capital price and interest, per SRS 7.3.
 *
 * Rounded to 2 decimals so the value stored in `stock_batches.selling_price`
 * matches what the user was shown in the form.
 */
export function sellingPriceFrom(
  capitalPrice: string | number | null | undefined,
  interestPercentage: string | number | null | undefined,
) {
  const capital = toNumber(capitalPrice);
  const interest = toNumber(interestPercentage);

  return Math.round(capital * (1 + interest / 100) * 100) / 100;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return dateOnly.format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return dateAndTime.format(new Date(value));
}
