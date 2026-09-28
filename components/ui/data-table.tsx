import type { ReactNode } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils/cn";

export type Column<Row> = {
  /** Column heading. */
  header: string;
  /** Cell renderer. Given the row so it can format or compose freely. */
  cell: (row: Row) => ReactNode;
  align?: "left" | "right";
  /** Hides the column below the `md` breakpoint to keep phones readable. */
  hideOnMobile?: boolean;
};

type DataTableProps<Row> = {
  rows: Row[];
  columns: Array<Column<Row>>;
  /** Stable React key per row — usually the database id. */
  rowKey: (row: Row) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /**
   * Minimum table width before the horizontal scroll kicks in, as a Tailwind
   * class.
   *
   * Deliberately `md:`-prefixed. Below that breakpoint `hideOnMobile` has
   * already removed the optional columns, so imposing a 640px floor there only
   * forces a sideways scroll on a table that would otherwise have fit. Leaving
   * the floor off on phones lets the table take exactly the width its remaining
   * content needs — narrow tables fit, wide ones still scroll, but only by the
   * amount they actually overflow.
   *
   * Must be a literal at the call site: Tailwind generates arbitrary values by
   * scanning source text, so a computed string would produce no CSS.
   */
  minWidth?: string;
};

/**
 * The one table used across products, inventory, sales, and reports.
 *
 * Rendering is driven by a column list rather than by children so every table
 * gets the same header treatment, row dividers, and empty state without each
 * page re-deriving them.
 */
export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Records will appear here once they are created.",
  emptyAction,
  minWidth = "md:min-w-[640px]",
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full border-collapse text-left text-sm", minWidth)}
      >
        <thead>
          <tr className="border-b border-slate-200 bg-[#f8fafc]">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn(
                  "px-2 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-600 sm:px-3 sm:py-3 sm:text-xs sm:tracking-[0.16em]",
                  column.align === "right" && "text-right",
                  column.hideOnMobile && "hidden md:table-cell",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-slate-100 last:border-0 transition hover:bg-blue-50/60"
            >
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn(
                    "px-2 py-3 align-middle text-xs text-slate-700 sm:px-3 sm:py-4 sm:text-sm",
                    column.align === "right" && "text-right",
                    column.hideOnMobile && "hidden md:table-cell",
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
