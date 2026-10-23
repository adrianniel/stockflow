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
  listCustomerCreditItems,
  listCustomerCreditSales,
  listCustomerPaymentGroups,
} from "@/lib/shop/queries";
import {
  formatCurrency,
  toNumber,
} from "@/lib/utils/format";

import { CollectionList } from "./collection-list";

export const metadata = { title: "Customer credit" };

/**
 * One customer's consolidated credit account: all credited items, all-time
 * totals, and one form for collecting against the combined outstanding balance.
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

  const allSales = await listCustomerCreditSales(context, customer.id);
  const activeSales = allSales.filter((sale) => sale.voided_at === null);
  const [items, payments] = await Promise.all([
    listCustomerCreditItems(context, activeSales),
    listCustomerPaymentGroups(context, allSales),
  ]);

  const totalCredit = activeSales.reduce(
    (total, sale) => total + toNumber(sale.total_amount),
    0,
  );
  const paid = activeSales.reduce(
    (total, sale) => total + toNumber(sale.amount_paid),
    0,
  );
  const outstanding = Math.max(totalCredit - paid, 0);

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

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total credited"
          value={formatCurrency(totalCredit)}
          delta={`${activeSales.length} credit sale${activeSales.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Paid so far"
          value={formatCurrency(paid)}
          delta="All payments received"
        />
        <StatCard
          label="Balance due"
          value={formatCurrency(outstanding)}
          delta={outstanding > 0 ? "One payment can cover any amount up to this total" : "Settled"}
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
          title="Credit item list"
          description="One combined history of the customer's credited products. Payments apply to the total balance, not individual items."
          actions={
            <ButtonLink href="/dashboard/credit" variant="secondary">
              Back to credit
            </ButtonLink>
          }
        />

        <CollectionList
          customerId={customer.id}
          items={items}
          payments={payments}
          totalCredit={totalCredit}
          paid={paid}
          outstanding={outstanding}
        />
      </Panel>
    </>
  );
}
