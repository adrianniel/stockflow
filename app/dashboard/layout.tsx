import type { ReactNode } from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { requireSession } from "@/lib/auth/guards";
import { navigationForRole } from "@/lib/auth/roles";

/**
 * Shared chrome for every /dashboard page.
 *
 * The sidebar lives here rather than in each page so the navigation is resolved
 * once per request from the signed-in role. Pages render only their own content.
 *
 * requireSession() here guarantees the shell never renders for an anonymous
 * visitor, but it does NOT authorize the page inside it — each page still calls
 * requireRole() for its own role check.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireSession();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 p-4 md:flex-row md:p-6 lg:p-8">
        <DashboardSidebar items={navigationForRole(profile.role)} />

        <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
