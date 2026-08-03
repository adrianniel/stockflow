import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listCustomersWithBalances } from "@/lib/shop/queries";
import { formatCurrency } from "@/lib/utils/format";

import { CreditManager } from "./credit-manager";

export const metadata = { title: "Credit" };

/**
 * Utang: who owes the shop money, and recording what they pay back.
 *
 * Open to assistants as well as owners. An assistant is usually the person a
 * customer hands a payment to, so they can add a customer and record a
 * collection; renaming, deleting, and editing payments are owner-only and are
 * enforced by RLS rather than by hiding buttons — though the buttons are hidden
 * too, since offering an action that will be refused is its own bug.
 */
export default async function CreditPage() {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const customers = await listCustomersWithBalances(context);

  const totalOutstanding = customers.reduce(
    (total, customer) => total + customer.outstanding,
    0,
  );

  const owing = customers.filter((customer) => customer.outstanding > 0);

  return (
    <>
      <DashboardHeader
        title="Credit"
        subtitle="Track what customers owe and record payments as they come in."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total outstanding"
          value={formatCurrency(totalOutstanding)}
          delta="Unpaid"
        />
        <StatCard
          label="Customers owing"
          value={`${owing.length}`}
          delta={`${customers.length} on file`}
        />
        <StatCard
          label="Unpaid sales"
          value={`${customers.reduce((count, customer) => count + customer.unpaidSaleCount, 0)}`}
          delta="To collect"
        />
      </div>

      <Panel>
        <CreditManager customers={customers} canManage={profile.role === "OWNER"} />
      </Panel>
    </>
  );
}
