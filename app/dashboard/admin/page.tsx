import { getCurrentUser } from "@/lib/supabase/auth.server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { RecentActivityTable } from "@/components/dashboard/recent-activity-table";
import { StatCard } from "@/components/dashboard/stat-card";
import { getAdminDashboardMetrics } from "@/lib/dashboard/admin-data";

const recentActivity = [
  {
    actor: "Northwind Store",
    action: "New inventory sync completed",
    detail: "1,204 items updated",
    time: "2 minutes ago",
  },
  {
    actor: "A. Morgan",
    action: "Created a new user",
    detail: "Role assigned: OWNER",
    time: "18 minutes ago",
  },
  {
    actor: "Central Warehouse",
    action: "Low stock alert triggered",
    detail: "12 products below threshold",
    time: "43 minutes ago",
  },
  {
    actor: "System",
    action: "Nightly report generated",
    detail: "Sales and stock summary ready",
    time: "1 hour ago",
  },
];

export default async function AdminDashboard() {
  const [user, metrics] = await Promise.all([
    getCurrentUser(),
    getAdminDashboardMetrics(),
  ]);

  const displayName =
    user?.email?.split("@")[0]?.replace(/[._-]/g, " ") ??
    "Super Admin";

  const displayEmail = user?.email ?? "admin@stockflow.app";

  const stats = [
    {
      label: "Total Shops",
      value: metrics.totalShops.toString(),
      delta: "All registered shops",
    },
    {
      label: "Total Users",
      value: metrics.totalUsers.toString(),
      delta: "All application users",
    },
    {
      label: "Active Shops",
      value: metrics.activeShops.toString(),
      delta: "Shops with ACTIVE status",
    },
    {
      label: "System Status",
      value: metrics.systemStatus,
      delta: metrics.systemDelta,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 md:p-6 lg:p-8">
        <DashboardSidebar />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <DashboardHeader
            title="Dashboard"
            subtitle="A centralized view of inventory, access, and operational health."
            userName={displayName}
            userEmail={displayEmail}
            role="SUPER_ADMIN"
          />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                delta={stat.delta}
              />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    Recent activity
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Operational events from shops, users, and platform jobs.
                  </p>
                </div>

                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  Live updates enabled
                </div>
              </div>

              <RecentActivityTable rows={recentActivity} />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="text-sm font-medium text-slate-300">
                    Current user
                  </p>
                  <div className="mt-3 space-y-2">
                    <h3 className="text-2xl font-semibold tracking-tight">
                      {displayName}
                    </h3>
                    <p className="text-sm text-slate-300">{displayEmail}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Role
                    </p>
                    <p className="mt-2 text-lg font-semibold">SUPER_ADMIN</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Access
                    </p>
                    <p className="mt-2 text-lg font-semibold">Full platform control</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}