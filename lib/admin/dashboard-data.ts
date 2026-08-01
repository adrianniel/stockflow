import { createSupabaseServerClient } from "@/lib/supabase/server";

import { listAllUsers, listShops, type AdminShop, type AdminUser } from "./queries";

/**
 * The platform administrator's home page data (SRS 5.1).
 *
 * Everything here is derived from the two lists the admin can already read —
 * shops and users — rather than from separate count queries. Two round trips
 * cover the whole page, and the numbers cannot disagree with the tables below
 * them the way independent COUNT(*) queries can.
 *
 * There is deliberately no sales, stock, or profit figure. Migration
 * 20260801120400 removed the super-admin bypass from every business table, so
 * those numbers are not readable here — and per SRS 5.1 they should not be.
 */

export type AdminDashboardMetrics = {
  totalShops: number;
  activeShops: number;
  totalUsers: number;
  activeUsers: number;
  systemStatus: string;
  systemDelta: string;
};

export type AdminDashboardData = {
  email: string;
  metrics: AdminDashboardMetrics;
  /** Active shops with no active owner — they cannot be used until one exists. */
  shopsWithoutOwner: AdminShop[];
  /** Newest accounts, for a quick read on recent provisioning. */
  recentUsers: AdminUser[];
};

export async function getAdminDashboardData(
  currentUserId: string,
): Promise<AdminDashboardData> {
  const supabase = await createSupabaseServerClient();

  const [userResult, shops, users] = await Promise.all([
    supabase.auth.getUser(),
    listShops(),
    listAllUsers(currentUserId),
  ]);

  if (userResult.error) {
    throw userResult.error;
  }

  const activeShops = shops.filter((shop) => shop.status === "ACTIVE");
  const activeUsers = users.filter((user) => user.status === "ACTIVE");

  const shopsWithoutOwner = activeShops.filter((shop) => shop.ownerCount === 0);

  // "Attention" means something needs a person to act, not that anything is
  // broken: a shop with no owner cannot be used by anyone, and a suspended shop
  // is a deliberate state worth keeping visible.
  const suspended = shops.length - activeShops.length;

  let systemStatus = "Healthy";
  let systemDelta = `${activeShops.length} of ${shops.length} shops active`;

  if (shops.length === 0) {
    systemStatus = "No shops";
    systemDelta = "Create the first shop to get started";
  } else if (shopsWithoutOwner.length > 0) {
    systemStatus = "Attention";
    systemDelta = `${shopsWithoutOwner.length} shop(s) have no owner`;
  } else if (suspended > 0) {
    systemStatus = "Attention";
    systemDelta = `${suspended} shop(s) suspended`;
  }

  // Re-sorted rather than sliced: listAllUsers orders by status and role first,
  // so its head is "active platform admins", not "newest accounts".
  const recentUsers = [...users]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 6);

  return {
    email: userResult.data.user?.email ?? "",
    metrics: {
      totalShops: shops.length,
      activeShops: activeShops.length,
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      systemStatus,
      systemDelta,
    },
    shopsWithoutOwner,
    recentUsers,
  };
}
