import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/guards";
import { dashboardPathForRole } from "@/lib/auth/roles";

/**
 * /dashboard is a router, not a page. It resolves the signed-in user's role and
 * forwards to the matching dashboard.
 */
export default async function DashboardPage() {
  const profile = await requireSession();

  redirect(dashboardPathForRole(profile.role));
}
