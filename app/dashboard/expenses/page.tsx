import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { listExpenses } from "@/lib/shop/expense-queries";
import { shopContextFor } from "@/lib/shop/context";

import { ExpenseManager } from "./expense-manager";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage() {
  const profile = await requireRole("OWNER", "ASSISTANT");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);
  const expenses = await listExpenses(context);

  return (
    <>
      <DashboardHeader
        title="Expenses"
        subtitle="Record operating costs and keep your daily net profit accurate."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <Panel>
        <ExpenseManager expenses={expenses} />
      </Panel>
    </>
  );
}
