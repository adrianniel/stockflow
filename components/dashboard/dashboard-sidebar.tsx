"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/dashboard/logout-button";
import type { NavItem } from "@/lib/auth/roles";

type DashboardSidebarProps = {
  items: NavItem[];
};

/**
 * Treats a nav item as active on its own path and on anything nested under it,
 * so /dashboard/products/new keeps "Products" highlighted.
 */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({ items }: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full flex-col rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:sticky md:top-6 md:h-[calc(100vh-3rem)] md:w-[280px] md:shrink-0 md:p-5">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
          SF
        </div>

        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-950">
            StockFlow
          </p>
          <p className="text-xs text-slate-500">Inventory management</p>
        </div>
      </div>

      <nav aria-label="Dashboard" className="mt-6 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active = isActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-6">
        <LogoutButton />
      </div>
    </aside>
  );
}