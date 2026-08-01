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
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn(
                  "px-3 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500",
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
              className="border-b border-slate-100 last:border-0 transition hover:bg-slate-50"
            >
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn(
                    "px-3 py-4 align-middle text-slate-700",
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
