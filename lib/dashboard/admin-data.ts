import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminDashboardMetrics = {
  totalShops: number;
  totalUsers: number;
  activeShops: number;
  systemStatus: string;
  systemDelta: string;
};

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const supabase = await createSupabaseServerClient();

  const [shopsResult, usersResult, activeShopsResult] = await Promise.all([
    supabase.from("shops").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
  ]);

  if (shopsResult.error) {
    throw shopsResult.error;
  }

  if (usersResult.error) {
    throw usersResult.error;
  }

  if (activeShopsResult.error) {
    throw activeShopsResult.error;
  }

  const totalShops = shopsResult.count ?? 0;
  const totalUsers = usersResult.count ?? 0;
  const activeShops = activeShopsResult.count ?? 0;

  let systemStatus = "Healthy";

  if (totalShops === 0) {
    systemStatus = "No shops";
  } else if (activeShops < totalShops) {
    systemStatus = "Attention";
  }

  return {
    totalShops,
    totalUsers,
    activeShops,
    systemStatus,
    systemDelta: `${activeShops} of ${totalShops} shops active`,
  };
}