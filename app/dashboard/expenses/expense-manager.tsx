"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { PanelHeader } from "@/components/ui/panel";
import { IDLE } from "@/lib/shop/action-result";
import { createExpense, deleteExpense, updateExpense } from "@/lib/shop/actions";
import type { Expense } from "@/lib/shop/types";
import { formatCurrency, formatDateKey } from "@/lib/utils/format";

export function ExpenseManager({ expenses }: { expenses: Expense[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const columns: Array<Column<Expense>> = [
    {
      header: "Date",
      cell: (row) => formatDateKey(row.expense_date),
    },
    {
      header: "Expense",
      cell: (row) => (
        <div>
          <span className="font-medium text-slate-950">{row.name}</span>
          {row.notes ? <p className="text-xs text-slate-500">{row.notes}</p> : null}
        </div>
      ),
    },
    {
      header: "Recorded by",
      hideOnMobile: true,
      cell: (row) => row.created_by_name ?? "—",
    },
    {
      header: "Amount",
      align: "right",
      cell: (row) => <span className="font-medium text-rose-700">{formatCurrency(row.amount)}</span>,
    },
    {
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
            Edit
          </Button>
          <ConfirmForm
            action={deleteExpense}
            values={{ id: row.id }}
            trigger="Delete"
            title={`Delete “${row.name}”?`}
            description="This expense will stop affecting reports, but the record will be retained for financial history."
            confirmLabel="Delete expense"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PanelHeader
        title="Expenses"
        description="Active expenses are deducted from net profit on their recorded dates."
        actions={<Button onClick={() => setCreateOpen(true)}>New expense</Button>}
      />

      <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Active expenses</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{formatCurrency(total)}</p>
      </div>

      <DataTable
        rows={expenses}
        columns={columns}
        rowKey={(row) => row.id}
        emptyTitle="No expenses yet"
        emptyDescription="Record rent, transport, utilities, or another operating cost."
        emptyAction={<Button onClick={() => setCreateOpen(true)}>New expense</Button>}
      />

      <ExpenseDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New expense"
        description="Choose today or a previous date for the expense."
      />
      <ExpenseDialog
        key={editing?.id ?? "edit-closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit expense"
        description="Correct the expense details. Its reports will recalculate automatically."
        expense={editing}
      />
    </>
  );
}

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function ExpenseDialog({
  open,
  onClose,
  title,
  description,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  expense?: Expense | null;
}) {
  const isEdit = Boolean(expense);
  const [state, formAction] = useActionState(isEdit ? updateExpense : createExpense, IDLE);
  const today = localToday();
  const initialDate = expense?.expense_date ?? today;
  const [dateMode, setDateMode] = useState<"today" | "custom">(
    initialDate === today ? "today" : "custom",
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <form action={formAction} className="space-y-4">
        {expense ? <input type="hidden" name="id" value={expense.id} /> : null}
        <input type="hidden" name="expense_date" value={selectedDate} />

        <Field label="Expense date" htmlFor="expense-date" error={fieldError(state, "expense_date")}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={dateMode === "today" ? "primary" : "secondary"}
              onClick={() => {
                setDateMode("today");
                setSelectedDate(today);
              }}
            >
              Today
            </Button>
            <Button
              type="button"
              variant={dateMode === "custom" ? "primary" : "secondary"}
              onClick={() => setDateMode("custom")}
            >
              Select date
            </Button>
          </div>

          {dateMode === "custom" ? (
            <div className="mt-3">
              <Input
                id="expense-date"
                type="date"
                value={selectedDate}
                max={today}
                onChange={(event) => setSelectedDate(event.target.value)}
                required
              />
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">This expense will be recorded for today.</p>
          )}
        </Field>

        <Field label="Expense name" htmlFor="expense-name" error={fieldError(state, "name")}>
          <Input
            id="expense-name"
            name="name"
            defaultValue={expense?.name ?? ""}
            placeholder="Transportation"
            maxLength={150}
            autoFocus
            required
          />
        </Field>

        <Field label="Amount" htmlFor="expense-amount" error={fieldError(state, "amount")}>
          <Input
            id="expense-amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={expense ? Number(expense.amount) : ""}
            placeholder="0.00"
            required
          />
        </Field>

        <Field label="Notes (optional)" htmlFor="expense-notes" error={fieldError(state, "notes")}>
          <Textarea
            id="expense-notes"
            name="notes"
            defaultValue={expense?.notes ?? ""}
            placeholder="Add a short note"
            maxLength={500}
            rows={3}
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <SubmitButton>{isEdit ? "Save changes" : "Record expense"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
