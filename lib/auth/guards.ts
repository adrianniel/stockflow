import { redirect } from "next/navigation";

import { getCurrentUser, getUserProfile } from "@/lib/supabase/auth.server";

import {
  dashboardPathForRole,
  isUserRole,
  type SessionProfile,
  type UserRole,
} from "./roles";

/**
 * Server-side route guards.
 *
 * Row Level Security already stops a user from *reading* another role's data,
 * but RLS returns empty results rather than an error — so an ASSISTANT hitting
 * /dashboard/admin would render the admin shell with zeroed-out numbers. These
 * guards make the boundary explicit: wrong role, wrong page, redirect.
 *
 * Every page under /dashboard must call one of these as its first statement.
 */

/** Requires a signed-in user with a matching, active row in `users`. */
export async function requireSession(): Promise<SessionProfile> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getUserProfile(user.id);

  // No profile row means the auth account was never linked to a `users` record.
  // Treat it as unauthenticated rather than guessing at permissions.
  if (!profile || !isUserRole(profile.role)) {
    redirect("/login");
  }

  // Deactivated accounts keep their Supabase auth login — revoking that needs
  // the admin API and therefore the service_role key, which this project does
  // not hold. So the block is enforced here, on every request. RLS still sees
  // them as a member of the shop, which is why this check cannot be skipped.
  if (profile.status === "INACTIVE") {
    redirect("/login?blocked=account");
  }

  // A shop switched to INACTIVE by the platform admin locks out its whole team.
  // SUPER_ADMIN has no shop and so is never caught by this.
  if (profile.shop_status === "INACTIVE") {
    redirect("/login?blocked=shop");
  }

  return profile;
}

/**
 * Requires the signed-in user to hold one of `allowed`. Anyone signed in but
 * holding a different role is sent to their own dashboard, not to /login —
 * they are authenticated, just not authorized for this page.
 */
export async function requireRole(
  ...allowed: UserRole[]
): Promise<SessionProfile> {
  const profile = await requireSession();

  if (!allowed.includes(profile.role)) {
    redirect(dashboardPathForRole(profile.role));
  }

  return profile;
}
