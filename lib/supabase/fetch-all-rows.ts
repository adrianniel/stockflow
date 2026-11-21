/**
 * Reads every row of a query, one page at a time.
 *
 * PostgREST returns at most `max_rows` rows per request (1000, set in
 * supabase/config.toml and the Supabase API settings). When a query matches
 * more rows than that, it does not error. It returns the first 1000 and drops
 * the rest. For a list that only ever grows, like stock batches or products,
 * that means the newest rows quietly disappear from the page once the shop
 * passes the limit.
 *
 * This helper asks for consecutive `.range()` windows until a window comes back
 * short, so the caller gets the complete result. It returns exactly the rows a
 * single unlimited query would return, in the same order. Each page is its own
 * request, so the order must be deterministic: always end the ordering with a
 * unique column (normally `id`). Without that tiebreaker, rows that tie on the
 * sort key could move between pages and be skipped or repeated.
 *
 * Only reads go through this. It never writes.
 */

/** Must not exceed the API's max_rows, or every page would look like the last. */
const PAGE_SIZE = 1000;

/**
 * A runaway backstop. A shop reaching this many rows in one list needs
 * SQL-side aggregation instead; failing loudly beats an endless loop.
 */
const MAX_ROWS = 100_000;

type PageResult = {
  data: unknown[] | null;
  error: unknown;
};

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data ?? []) as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }

  throw new Error(
    `A list reached ${MAX_ROWS} rows, which is more than this page can load at once.`,
  );
}
