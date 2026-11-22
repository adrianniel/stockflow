import { PanelHeader } from "@/components/ui/panel";
import type { ExpenseHistoryEntry, ExpenseSnapshot } from "@/lib/shop/types";
import { formatCurrency, formatDateKey, formatDateTime } from "@/lib/utils/format";

const FIELD_LABELS: Array<[keyof ExpenseSnapshot, string]> = [
  ["name", "Name"],
  ["amount", "Amount"],
  ["expense_date", "Date"],
  ["notes", "Notes"],
];

const ACTION_LABELS: Record<ExpenseHistoryEntry["action"], string> = {
  EDIT: "Edited",
  DELETE: "Deleted",
  RESTORE: "Restored",
};

function display(field: keyof ExpenseSnapshot, value: ExpenseSnapshot[keyof ExpenseSnapshot]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (field === "amount") {
    return formatCurrency(value);
  }

  if (field === "expense_date") {
    return formatDateKey(String(value));
  }

  return String(value);
}

/**
 * Read-only log of changes to expenses, so an edited or deleted cost can always
 * be traced back to what it was and who changed it.
 */
export function ExpenseHistory({ entries }: { entries: ExpenseHistoryEntry[] }) {
  return (
    <>
      <PanelHeader
        title="Change history"
        description="Every edit or deletion of an expense is recorded here with the previous values. Expenses recorded before this log existed have no earlier history."
      />

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
          No expense changes recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200">
          {entries.map((entry) => {
            const changes = FIELD_LABELS.filter(
              ([field]) =>
                String(entry.old_values[field] ?? "") !==
                String(entry.new_values[field] ?? ""),
            );
            const name = entry.new_values.name ?? entry.old_values.name ?? "Expense";

            return (
              <li key={entry.id} className="px-4 py-3 sm:px-5">
                <p className="text-sm font-semibold text-slate-950">
                  {ACTION_LABELS[entry.action]} · {name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {formatDateTime(entry.changed_at)} ·{" "}
                  {entry.changed_by_name ?? "Unknown staff"}
                </p>
                {entry.action === "EDIT" && changes.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-700">
                    {changes.map(([field, label]) => (
                      <li key={field}>
                        {label}: {display(field, entry.old_values[field])} →{" "}
                        {display(field, entry.new_values[field])}
                      </li>
                    ))}
                  </ul>
                ) : entry.action !== "EDIT" ? (
                  <p className="mt-2 text-xs text-slate-700">
                    Amount {display("amount", entry.old_values.amount)} · dated{" "}
                    {display("expense_date", entry.old_values.expense_date)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
