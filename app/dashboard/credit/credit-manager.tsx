"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { PanelHeader } from "@/components/ui/panel";
import { IDLE } from "@/lib/shop/action-result";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/lib/shop/actions";
import type { CustomerWithBalance } from "@/lib/shop/types";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type CreditManagerProps = {
  customers: CustomerWithBalance[];
  /** True for OWNER. Assistants may add a customer but not rename or remove one. */
  canManage: boolean;
};

/**
 * The customer list, with each person's outstanding balance.
 *
 * Sorted by what they owe, largest first, because the reason to open this page
 * is almost always to chase a debt. Customers with a clear balance sink to the
 * bottom rather than being hidden — the list doubles as the shop's customer
 * roster, and a settled customer still needs to be findable to be renamed.
 */
export function CreditManager({ customers, canManage }: CreditManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerWithBalance | null>(null);

  const sorted = [...customers].sort((a, b) => {
    if (b.outstanding !== a.outstanding) {
      return b.outstanding - a.outstanding;
    }

    return a.name.localeCompare(b.name);
  });

  const columns: Array<Column<CustomerWithBalance>> = [
    {
      header: "Customer",
      cell: (row) => (
        <div className="min-w-0">
          <Link
            href={`/dashboard/credit/${row.id}`}
            className="font-medium text-slate-950 underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
          {row.phone ? (
            <p className="truncate text-xs text-slate-500">{row.phone}</p>
          ) : null}
        </div>
      ),
    },
    {
      header: "Owes",
      align: "right",
      cell: (row) =>
        row.outstanding > 0 ? (
          <span className="font-semibold text-slate-950">
            {formatCurrency(row.outstanding)}
          </span>
        ) : (
          <Badge tone="positive">Settled</Badge>
        ),
    },
    {
      header: "Unpaid sales",
      align: "right",
      hideOnMobile: true,
      cell: (row) => row.unpaidSaleCount,
    },
    {
      header: "Owing since",
      hideOnMobile: true,
      cell: (row) =>
        row.oldestUnpaidDate ? formatDate(row.oldestUnpaidDate) : "—",
    },
    {
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <ButtonLink
            href={`/dashboard/credit/${row.id}`}
            variant="ghost"
            size="sm"
          >
            {row.outstanding > 0 ? "Collect" : "View"}
          </ButtonLink>

          {canManage ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
                Edit
              </Button>

              <ConfirmForm
                action={deleteCustomer}
                values={{ id: row.id }}
                trigger="Delete"
                title={`Remove "${row.name}"?`}
                description={
                  row.outstanding > 0
                    ? `${row.name} still owes ${formatCurrency(row.outstanding)}. Collect or settle the balance first — this will be refused.`
                    : "Their past sales stay in your records, but will no longer show a customer name."
                }
                confirmLabel="Remove customer"
              />
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PanelHeader
        title="Customers"
        description="Anyone who buys on credit. Tap a name to see their unpaid sales and record a payment."
        actions={<Button onClick={() => setCreateOpen(true)}>New customer</Button>}
      />

      <DataTable
        rows={sorted}
        columns={columns}
        rowKey={(row) => row.id}
        emptyTitle="No customers yet"
        emptyDescription="Add a customer to start recording credit sales against a name."
        emptyAction={<Button onClick={() => setCreateOpen(true)}>New customer</Button>}
      />

      <CustomerDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New customer"
        description="A name is all that is required. Phone and notes are optional."
      />

      <CustomerDialog
        key={editing?.id ?? "edit-closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit customer"
        description="Their sales and payments stay attached."
        customer={editing}
      />
    </>
  );
}

type CustomerDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Present for edit, absent for create. */
  customer?: CustomerWithBalance | null;
};

/**
 * One dialog for both create and edit, matching CategoryDialog.
 *
 * The parent remounts it via `key` on open, which resets the action state and
 * the uncontrolled inputs — otherwise a previous error would still be showing.
 */
function CustomerDialog({
  open,
  onClose,
  title,
  description,
  customer,
}: CustomerDialogProps) {
  const isEdit = Boolean(customer);
  const [state, formAction] = useActionState(
    isEdit ? updateCustomer : createCustomer,
    IDLE,
  );

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <form action={formAction} className="space-y-4">
        {customer ? <input type="hidden" name="id" value={customer.id} /> : null}

        <Field
          label="Customer name"
          htmlFor="customer-name"
          error={fieldError(state, "name")}
        >
          <Input
            id="customer-name"
            name="name"
            defaultValue={customer?.name ?? ""}
            placeholder="Juan dela Cruz"
            maxLength={120}
            autoFocus
            required
          />
        </Field>

        <Field
          label="Phone"
          htmlFor="customer-phone"
          error={fieldError(state, "phone")}
          hint="Optional."
        >
          <Input
            id="customer-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={customer?.phone ?? ""}
            placeholder="09XX XXX XXXX"
            maxLength={40}
          />
        </Field>

        <Field
          label="Notes"
          htmlFor="customer-notes"
          error={fieldError(state, "notes")}
          hint="Optional — anything worth remembering about this customer."
        >
          <Textarea
            id="customer-notes"
            name="notes"
            defaultValue={customer?.notes ?? ""}
            maxLength={500}
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton>{isEdit ? "Save changes" : "Add customer"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
