"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { recordPayment } from "@/lib/shop/actions";
import { IDLE } from "@/lib/shop/action-result";
import type { SaleItem, SalePayment } from "@/lib/shop/types";
import {
  formatCurrency,
  formatDateTime,
  formatDateKey,
  toNumber,
} from "@/lib/utils/format";

type UnpaidSale = {
  id: string;
  saleDate: string | null;
  total: number;
  paid: number;
  paymentStatus: string;
  payments: SalePayment[];
  sellerName: string | null;
  items: SaleItem[];
};

/**
 * The unsettled sales, each with its own collection form.
 *
 * Not a DataTable: every row carries a form and an expandable payment history,
 * which a table cell cannot hold without the columns collapsing on a phone.
 */
export function CollectionList({
  customerId,
  sales,
}: {
  customerId: string;
  sales: UnpaidSale[];
}) {
  if (sales.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-950">Nothing outstanding</p>
        <p className="mt-1 text-sm text-slate-500">
          This customer has settled every sale on their account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sales.map((sale) => (
        <SaleCard key={sale.id} customerId={customerId} sale={sale} />
      ))}
    </div>
  );
}

function SaleCard({
  customerId,
  sale,
}: {
  customerId: string;
  sale: UnpaidSale;
}) {
  const [state, action] = useActionState(recordPayment, IDLE);
  const [showHistory, setShowHistory] = useState(false);
  const [collectedAt, setCollectedAt] = useState(() =>
    toDateTimeLocal(new Date()),
  );

  const outstanding = sale.total - sale.paid;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-slate-950">
              Sale {sale.id.slice(0, 8).toUpperCase()}
            </p>
            <span className="text-xs text-slate-500">
              {formatDateTime(sale.saleDate)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Recorded by {sale.sellerName ?? "Unknown staff"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge tone={sale.paymentStatus === "PARTIAL" ? "warning" : "danger"}>
            {sale.paymentStatus === "PARTIAL" ? "Partially paid" : "Credit"}
          </Badge>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
              Owes
            </p>
            <p className="text-base font-semibold text-slate-950">
              {formatCurrency(outstanding)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Items in this credit sale
          </h3>
          <Link
            href={`/dashboard/sales/${sale.id}`}
            className="text-xs font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:decoration-blue-700"
          >
            Full sale details
          </Link>
        </div>
        {sale.items.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {sale.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {item.product_name ?? "Historical product"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Qty {item.quantity} · {formatCurrency(item.actual_selling_price)} each
                    {item.batch_number
                      ? ` · Batch ${item.batch_number}${item.batch_received_date ? `, received ${formatDateKey(item.batch_received_date)}` : ""}`
                      : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-slate-800">
                  {formatCurrency(toNumber(item.actual_selling_price) * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            Item details are unavailable for this historical sale.
          </p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-100 px-3 py-3 text-xs sm:gap-4 sm:px-4">
        <div>
          <dt className="text-slate-500">Sale total</dt>
          <dd className="mt-1 font-semibold tabular-nums text-slate-900">
            {formatCurrency(sale.total)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Paid so far</dt>
          <dd className="mt-1 font-semibold tabular-nums text-emerald-700">
            {formatCurrency(sale.paid)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Balance left</dt>
          <dd className="mt-1 font-semibold tabular-nums text-amber-800">
            {formatCurrency(outstanding)}
          </dd>
        </div>
      </dl>

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="sale_id" value={sale.id} />
        <input
          type="hidden"
          name="collected_at"
          value={toIsoTimestamp(collectedAt)}
          suppressHydrationWarning
        />
        {/* Lets the action revalidate this page after the payment. The server
            still derives shop and customer from the sale itself. */}
        <input type="hidden" name="customer_id" value={customerId} />

        <FormAlert state={state} />

        <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end">
          <Field
            label="Amount"
            htmlFor={`amount-${sale.id}`}
            error={fieldError(state, "amount")}
          >
            <Input
              id={`amount-${sale.id}`}
              name="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={outstanding}
              placeholder={`${outstanding}`}
              required
            />
          </Field>

          <Field
            label="Received date and time"
            htmlFor={`collected-at-${sale.id}`}
            error={fieldError(state, "collected_at")}
            hint="When the customer actually paid."
          >
            <Input
              id={`collected-at-${sale.id}`}
              name="collected_at_local"
              type="datetime-local"
              value={collectedAt}
              suppressHydrationWarning
              onChange={(event) => setCollectedAt(event.target.value)}
              required
            />
          </Field>

          <Field
            label="Note (optional)"
            htmlFor={`note-${sale.id}`}
            error={fieldError(state, "note")}
          >
            <Input
              id={`note-${sale.id}`}
              name="note"
              maxLength={200}
              placeholder="e.g. partial, balance next week"
            />
          </Field>

          <SubmitButton pendingLabel="Recording...">Record payment</SubmitButton>
        </div>
      </form>

      {sale.payments.length > 0 ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((current) => !current)}
            aria-expanded={showHistory}
          >
            {showHistory ? "Hide" : "View"} payment history · {sale.payments.length}
          </Button>

          {showHistory ? (
            <ul className="mt-3 space-y-2">
              {sale.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-950">
                    {formatCurrency(payment.amount)}
                  </span>
                  <span className="text-xs text-slate-500">
                    Received {formatDateTime(payment.collected_at)}
                    {isDelayedEntry(payment) ? (
                      <span className="block">
                        Entered {formatDateTime(payment.created_at)}
                      </span>
                    ) : null}
                    {payment.collected_by_name
                      ? ` · ${payment.collected_by_name}`
                      : ""}
                    {payment.note ? ` · ${payment.note}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function toDateTimeLocal(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/**
 * `datetime-local` deliberately has no timezone information. Convert the
 * browser-local value before it crosses the server boundary so the action and
 * PostgreSQL compare the actual instant rather than reinterpreting the local
 * wall-clock time in the server's timezone.
 */
function toIsoTimestamp(value: string): string {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function isDelayedEntry(payment: SalePayment): boolean {
  return (
    Math.abs(
      new Date(payment.created_at).getTime() -
        new Date(payment.collected_at).getTime(),
    ) >= 60_000
  );
}
