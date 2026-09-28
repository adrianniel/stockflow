import { Badge } from "@/components/ui/badge";
import { roleLabel, type UserRole } from "@/lib/auth/roles";

type DashboardHeaderProps = {
  title: string;
  subtitle: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  /**
   * The signed-in user's shop. Leads the eyebrow so an owner or assistant sees
   * their own store named on every page. Null for SUPER_ADMIN, which belongs to
   * no shop and shows the role alone.
   */
  shopName?: string | null;
};

export function DashboardHeader({
  title,
  subtitle,
  userName,
  userEmail,
  role,
  shopName,
}: DashboardHeaderProps) {
  return (
    <header className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_10px_32px_rgba(15,23,42,0.06)] sm:rounded-3xl sm:p-5 lg:p-6">
      <p className="sr-only">
        {shopName ? `${shopName} · ` : ""}{roleLabel(role)}
      </p>
      <div className="flex items-center justify-between gap-3 sm:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-[#07152e] sm:text-2xl lg:text-3xl">
              {title}
            </h1>
            <span className="sm:hidden"><Badge>{role}</Badge></span>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-600 sm:mt-2 sm:text-sm sm:leading-6">
            {subtitle}
          </p>
        </div>

        <div className="hidden min-w-0 shrink-0 items-center gap-3 rounded-2xl border border-blue-100 bg-[#eff6ff] px-3 py-2.5 sm:flex sm:max-w-[14rem] lg:max-w-[18rem]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#07152e] text-xs font-semibold text-white sm:h-10 sm:w-10 sm:text-sm">
            {userName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-950 sm:text-sm">
              {userName}
            </p>
            <p className="truncate text-[0.68rem] text-slate-500 sm:text-xs">{userEmail}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
