import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { requireSession } from "@/lib/auth/guards";
import { navigationForRole } from "@/lib/auth/roles";
import { getCurrentUser, getUserProfile } from "@/lib/supabase/auth.server";

/**
 * Puts the shop's name in the browser tab, so a tab reads "Sales | Kang Auto
 * Supply" rather than the product name. Falls back to the root layout's
 * "%s | StockFlow" for SUPER_ADMIN, which belongs to no shop.
 *
 * This reads the session rather than receiving it as a prop because Next.js
 * calls generateMetadata separately from the component render. Both calls land
 * in the same request, and getCurrentUser/getUserProfile are per-request cached,
 * so this adds no extra query. It deliberately does not call requireSession():
 * redirecting from metadata generation is not a thing, so an unauthenticated
 * request just falls through to the default and the layout below does the
 * redirecting.
 */
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser().catch(() => null);
  const profile = user ? await getUserProfile(user.id).catch(() => null) : null;

  if (!profile?.shop_name) {
    return {};
  }

  return {
    title: {
      default: profile.shop_name,
      template: `%s | ${profile.shop_name}`,
    },
  };
}

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
      {/*
        No top padding below `md`: the sidebar's mobile bar is sticky and sits
        flush against the top edge, the way an app header does. From `md` up the
        bar is gone and the usual padding applies on all sides.
      */}
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 pb-4 md:flex-row md:p-6 lg:p-8">
        <DashboardSidebar
          items={navigationForRole(profile.role)}
          profile={profile}
        />

        <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
