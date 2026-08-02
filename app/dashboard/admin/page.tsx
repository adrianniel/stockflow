import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireRole } from "@/lib/auth/guards";
import { getAdminDashboardData } from "@/lib/admin/dashboard-data";
import type { AdminShop, AdminUser } from "@/lib/admin/queries";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Admin dashboard" };

const ROLE_LABELS: Record<AdminUser["role"], string> = {
  SUPER_ADMIN: "Platform admin",
  OWNER: "Owner",
  ASSISTANT: "Assistant",
};

/**
 * Platform administrator home (SRS 5.1).
 *
 * Counts shops and accounts, and surfaces the one thing that actually blocks a
 * shop from working: no owner account. No sales, stock, or profit figures — the
 * super admin cannot read business data, by policy and by RLS.
 */
export default async function AdminDashboard() {
  const profile = await requireRole("SUPER_ADMIN");
  const { email, metrics, shopsWithoutOwner, recentUsers } =
    await getAdminDashboardData(profile.id);

  // Prefer the name on the `users` row; fall back to the email local part only
  // when the profile has no name yet.
  const displayName =
    profile.name ??
    email.split("@")[0]?.replace(/[._-]/g, " ") ??
    "Super Admin";

  const displayEmail = email || "admin@stockflow.app";

  const stats = [
    {
      label: "Shops",
      value: metrics.totalShops.toString(),
      delta: `${metrics.activeShops} active`,
    },
    {
      label: "Accounts",
      value: metrics.totalUsers.toString(),
      delta: `${metrics.activeUsers} active`,
    },
    {
      label: "Needs an owner",
      value: shopsWithoutOwner.length.toString(),
      delta:
        shopsWithoutOwner.length === 0
          ? "Every active shop has one"
          : "Cannot be used until fixed",
    },
    {
      label: "System status",
      value: metrics.systemStatus,
      delta: metrics.systemDelta,
    },
  ];

  const ownerlessColumns: Array<Column<AdminShop>> = [
    {
      header: "Shop",
      cell: (row) => (
        <span className="font-medium text-slate-950">{row.shop_name}</span>
      ),
    },
    {
      header: "Created",
      hideOnMobile: true,
      cell: (row) => formatDate(row.created_at),
    },
    {
      header: "",
      align: "right",
      cell: () => (
        <Link
          href="/dashboard/users"
          className="text-sm font-medium text-slate-950 underline underline-offset-4"
        >
          Add owner
        </Link>
      ),
    },
  ];

  const userColumns: Array<Column<AdminUser>> = [
    {
      header: "Account",
      cell: (row) => (
        <div>
          <span className="font-medium text-slate-950">
            {row.name ?? "Unnamed"}
          </span>
          <p className="text-xs text-slate-500">{row.shopName ?? "No shop"}</p>
        </div>
      ),
    },
    {
      header: "Role",
      cell: (row) => ROLE_LABELS[row.role],
    },
    {
      header: "Status",
      align: "right",
      cell: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "positive" : "danger"}>
          {row.status === "ACTIVE" ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DashboardHeader
        title="Dashboard"
        subtitle="Shops and accounts across the platform."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
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

      {shopsWithoutOwner.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Shops without an owner"
            description="These shops are active but nobody can sign in to them yet."
            actions={
              <Link href="/dashboard/users">
                <Button>Add an owner</Button>
              </Link>
            }
          />

          <DataTable
            rows={shopsWithoutOwner}
            columns={ownerlessColumns}
            rowKey={(row) => row.id}
          />
        </Panel>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader
            title="Newest accounts"
            description="The most recently provisioned logins."
            actions={
              <Link href="/dashboard/users">
                <Button variant="secondary">All users</Button>
              </Link>
            }
          />

          <DataTable
            rows={recentUsers}
            columns={userColumns}
            rowKey={(row) => row.id}
            emptyTitle="No accounts yet"
            emptyDescription="Create a shop, then add its owner account."
          />
        </Panel>

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="flex h-full flex-col justify-between gap-8">
            <div>
              <p className="text-sm font-medium text-slate-300">Current user</p>
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
                <p className="mt-2 text-lg font-semibold">{profile.role}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Access
                </p>
                <p className="mt-2 text-lg font-semibold">
                  Shops and users only
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
