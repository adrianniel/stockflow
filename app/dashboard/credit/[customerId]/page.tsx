import { notFound } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ButtonLink } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import {
  getCustomer,
  listCustomerUnpaidSales,
  listSalePayments,
} from "@/lib/shop/queries";
import { formatCurrency, formatDate, toNumber } from "@/lib/utils/format";

import { CollectionList } from "./collection-list";

export const metadata = { title: "Customer credit" };

/**
 * One customer's debt, and the form for taking money against it.
 *
 * Payments are recorded per sale rather than as one lump against the customer.
 * That is deliberate: profit is already attributed per sale, and a shop that
 * takes 500 off a 2,000 balance needs to know which sale is now settled — a
 * customer-level balance could not answer that without guessing an allocation.
 * Sales are listed oldest first, which is the order a shop collects in.
 */
export default async function CustomerCreditPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const customer = await getCustomer(context, customerId);

  // Null covers both "no such customer" and "belongs to another shop" — the
  // query is shop-scoped, so the two are indistinguishable here by design.
  if (!customer) {
    notFound();
  }

  const unpaidSales = await listCustomerUnpaidSales(context, customer.id);

  // One query per unsettled sale. Fine at this scale: a customer with more than
  // a handful of open debts is a collections problem, and the alternative is a
  // second denormalised aggregate to keep in step with the ledger.
  const paymentsPerSale = await Promise.all(
    unpaidSales.map((sale) => listSalePayments(context, sale.id)),
  );

  const sales = unpaidSales.map((sale, index) => ({
    id: sale.id,
    saleDate: sale.sale_date,
    total: toNumber(sale.total_amount),
    paid: toNumber(sale.amount_paid),
    paymentStatus: sale.payment_status,
    payments: paymentsPerSale[index],
  }));

  const outstanding = sales.reduce(
    (total, sale) => total + (sale.total - sale.paid),
    0,
  );

  const oldest = sales.length > 0 ? sales[0].saleDate : null;

  return (
    <>
      <DashboardHeader
        title={customer.name}
        subtitle={
          customer.phone
            ? `Credit account · ${customer.phone}`
            : "Credit account"
        }
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Outstanding"
          value={formatCurrency(outstanding)}
          delta={outstanding > 0 ? "To collect" : "Settled"}
        />
        <StatCard
          label="Unpaid sales"
          value={`${sales.length}`}
          delta={sales.length > 0 ? "Oldest first" : "Nothing due"}
        />
        <StatCard
          label="Owing since"
          value={oldest ? formatDate(oldest) : "—"}
          delta={oldest ? "First unpaid sale" : "No open debt"}
        />
      </div>

      {customer.notes ? (
        <Panel>
          <PanelHeader title="Notes" description="Recorded against this customer." />
          <p className="whitespace-pre-line text-sm text-slate-700">
            {customer.notes}
          </p>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Unpaid sales"
          description="Record what the customer hands over. A payment can never exceed what is still owed on that sale."
          actions={
            <ButtonLink href="/dashboard/credit" variant="secondary">
              Back to credit
            </ButtonLink>
          }
        />

        <CollectionList customerId={customer.id} sales={sales} />
      </Panel>
    </>
  );
}
