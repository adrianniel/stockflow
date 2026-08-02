import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { listAllUsers, listShopOptions } from "@/lib/admin/queries";
import { getDashboardIdentity } from "@/lib/dashboard/identity";

import { UserManager } from "./user-manager";

export const metadata = { title: "Users" };

/**
 * Account registry (SRS 5.1, 6.2). SUPER_ADMIN only.
 */
export default async function UsersPage() {
  const profile = await requireRole("SUPER_ADMIN");

  const [{ displayName, displayEmail }, users, shops] = await Promise.all([
    getDashboardIdentity(profile),
    listAllUsers(profile.id),
    listShopOptions(),
  ]);

  return (
    <>
      <DashboardHeader
        title="Users"
        subtitle="Owner and assistant accounts across every shop."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      <Panel>
        <UserManager users={users} shops={shops} />
      </Panel>
    </>
  );
}
