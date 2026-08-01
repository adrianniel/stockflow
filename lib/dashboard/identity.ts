import type { SessionProfile } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/supabase/auth.server";

export type DashboardIdentity = {
  displayName: string;
  displayEmail: string;
};

/**
 * The name and email shown in the dashboard header.
 *
 * The `users` row is the source of truth for the name; the auth account is the
 * source of truth for the email. `users.email` exists as a display copy for
 * listing other people's accounts, but for the signed-in user the live auth
 * address is read directly and cannot be stale. When a profile has no name yet —
 * invited but never completed — the email local part is used so the header never
 * renders blank.
 */
export async function getDashboardIdentity(
  profile: SessionProfile,
): Promise<DashboardIdentity> {
  const user = await getCurrentUser();

  const displayName =
    profile.name ??
    user?.email?.split("@")[0]?.replace(/[._-]/g, " ") ??
    "StockFlow user";

  return {
    displayName,
    displayEmail: user?.email ?? "",
  };
}
