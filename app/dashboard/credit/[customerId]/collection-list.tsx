"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { recordCustomerPayment } from "@/lib/shop/actions";
import { IDLE } from "@/lib/shop/action-result";
import type { CustomerCreditItem, CustomerPaymentGroup } from "@/lib/shop/types";
import {
  formatCurrency,
  formatDateKey,
  formatDateTime,
  toNumber,
} from "@/lib/utils/format";

/** One list for every credited item, with one customer-level collection form. */
export function CollectionList({
  customerId,
  items,
  payments,
  totalCredit,
  paid,
  outstanding,
}: {
  customerId: string;
  items: CustomerCreditItem[];
  payments: CustomerPaymentGroup[];
  totalCredit: number;
  paid: number;
  outstanding: number;
}) {
  const [state, formAction] = useActionState(recordCustomerPayment, IDLE);
  const [showHistory, setShowHistory] = useState(false);
  const [collectedAt, setCollectedAt] = useState(() => toDateTimeLocal(new Date()));

  // One random request id per payment. It is drawn on the first submit and
  // kept until that payment succeeds, so a retry after a lost response (slow
  // connection) sends the same id and the server returns the payment already
  // recorded instead of crediting the customer twice.
  const [requestId, setRequestId] = useState("");
  const requestInput = useRef<HTMLInputElement>(null);
  const [handledState, setHandledState] = useState(state);

  if (state !== handledState) {
    setHandledState(state);

    if (state.status === "success") {
      setRequestId("");
    }
  }

  function attachRequestId() {
    let id = requestId;

    // randomUUID needs a secure context (HTTPS or localhost). Without it the
    // payment is recorded the old way, without duplicate protection.
    if (id === "" && typeof crypto.randomUUID === "function") {
      id = crypto.randomUUID();
      setRequestId(id);
    }

    // Written straight to the DOM so it is in the FormData React builds for
    // this very submit, before the state update renders.
    if (requestInput.current) {
      requestInput.current.value = id;
    }
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="credit-items-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="credit-items-heading"
              className="text-sm font-semibold text-slate-950"
            >
              Items bought on credit
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {items.length} item line{items.length === 1 ? "" : "s"} across this
              customer’s credit history.
            </p>
          </div>
          <Link
            href="/dashboard/credit"
            className="text-sm font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:decoration-blue-700"
          >
            Back to customers
          </Link>
        </div>

        {items.length > 0 ? (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {item.product_name ?? "Historical product"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Qty {item.quantity}
                    {item.batch_number
                      ? ` · Batch ${item.batch_number}${item.batch_received_date ? ` · received ${formatDateKey(item.batch_received_date)}` : ""}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Sale {item.sale_id.slice(0, 8).toUpperCase()} ·{" "}
                    {formatDateTime(item.sale_date)} ·{" "}
                    {item.seller_name ?? "Unknown staff"}
                  </p>
                </div>
                <Link
                  href={`/dashboard/sales/${item.sale_id}`}
                  className="shrink-0 text-xs font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:decoration-blue-700"
                >
                  Sale details
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-950">No credit items yet</p>
            <p className="mt-1 text-sm text-slate-500">
              New credit sales for this customer will appear in this list.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="record-customer-payment-heading"
        className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5"
      >
        <div className="mb-4">
          <h2
            id="record-customer-payment-heading"
            className="text-sm font-semibold text-slate-950"
          >
            Record a payment against the total
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter any amount up to {formatCurrency(outstanding)}. The system
            applies it to the oldest outstanding sale first; you do not need to
            choose products or sales.
          </p>
        </div>

        {outstanding > 0 ? (
          <form action={formAction} onSubmit={attachRequestId} className="space-y-3">
            <input type="hidden" name="customer_id" value={customerId} />
            <input
              ref={requestInput}
              type="hidden"
              name="client_request_id"
              defaultValue=""
            />
            <input
              type="hidden"
              name="collected_at"
              value={toIsoTimestamp(collectedAt)}
              suppressHydrationWarning
            />

            <FormAlert state={state} />

            <div className="grid gap-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-end">
              <Field
                label="Payment amount"
                htmlFor={`customer-payment-${customerId}`}
                error={fieldError(state, "amount")}
              >
                <Input
                  id={`customer-payment-${customerId}`}
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={outstanding.toFixed(2)}
                  placeholder={outstanding.toFixed(2)}
                  required
                />
              </Field>

              <Field
                label="Received date and time"
                htmlFor={`customer-collected-at-${customerId}`}
                error={fieldError(state, "collected_at")}
                hint="When the customer actually paid."
              >
                <Input
                  id={`customer-collected-at-${customerId}`}
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
                htmlFor={`customer-payment-note-${customerId}`}
                error={fieldError(state, "note")}
              >
                <Input
                  id={`customer-payment-note-${customerId}`}
                  name="note"
                  maxLength={200}
                  placeholder="e.g. installment, balance next week"
                />
              </Field>

              <SubmitButton pendingLabel="Recording...">
                Record payment
              </SubmitButton>
            </div>
          </form>
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            This customer has paid the full credit balance.
          </p>
        )}
      </section>

      <section aria-labelledby="customer-payment-history-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              id="customer-payment-history-heading"
              className="text-sm font-semibold text-slate-950"
            >
              Payment history
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Each installment is shown once, even if it covered multiple sales.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHistory((current) => !current)}
            aria-expanded={showHistory}
            aria-controls={`customer-payment-history-${customerId}`}
          >
            {showHistory ? "Hide" : "Show"} {payments.length} payment
            {payments.length === 1 ? "" : "s"}
          </Button>
        </div>

        {showHistory ? (
          <ul
            id={`customer-payment-history-${customerId}`}
            className="mt-3 space-y-2"
          >
            {payments.length > 0 ? (
              payments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-slate-950">
                      {formatCurrency(payment.amount)}
                    </p>
                    {toNumber(payment.voided_amount) > 0 ? (
                      <p className="mt-0.5 text-xs text-amber-700">
                        {formatCurrency(payment.applied_amount)} still applies ·{" "}
                        {formatCurrency(payment.voided_amount)} allocation voided
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-500">
                    Received {formatDateTime(payment.collected_at)}
                    {payment.collected_by_name
                      ? ` · ${payment.collected_by_name}`
                      : ""}
                    {payment.note ? ` · ${payment.note}` : ""}
                    {Math.abs(
                      new Date(payment.created_at).getTime() -
                        new Date(payment.collected_at).getTime(),
                    ) >= 60_000
                      ? ` · entered ${formatDateTime(payment.created_at)}`
                      : ""}
                  </p>
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No payments have been recorded yet.
              </li>
            )}
          </ul>
        ) : null}
      </section>

      <p className="text-xs text-slate-500">
        Credit total: {formatCurrency(totalCredit)} · Paid: {formatCurrency(paid)} ·
        {" "}Balance: {formatCurrency(outstanding)}
      </p>
    </div>
  );
}

function toDateTimeLocal(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function toIsoTimestamp(value: string): string {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}
