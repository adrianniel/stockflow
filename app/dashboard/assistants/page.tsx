import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Panel } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { listShopMembers } from "@/lib/shop/queries";

import { AssistantManager } from "./assistant-manager";

/**
 * Assistant accounts (SRS 5.2, 6.2).
 *
 * OWNER only. Assistants do not manage accounts, so the sidebar omits the link
 * for them — requireRole() is what enforces it.
 */
export default async function AssistantsPage() {
  const profile = await requireRole("OWNER");
  const [{ displayName, displayEmail }, context] = await Promise.all([
    getDashboardIdentity(profile),
    shopContextFor(profile),
  ]);

  const members = await listShopMembers(context);

  return (
    <>
      <DashboardHeader
        title="Assistants"
        subtitle="Give your staff their own logins."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
      />

      <Panel>
        <AssistantManager members={members} />
      </Panel>
    </>
  );
}
