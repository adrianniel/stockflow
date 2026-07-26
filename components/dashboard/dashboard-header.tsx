import { Badge } from "@/components/ui/badge";

type DashboardHeaderProps = {
  title: string;
  subtitle: string;
  userName: string;
  userEmail: string;
  role: string;
};

export function DashboardHeader({
  title,
  subtitle,
  userName,
  userEmail,
  role,
}: DashboardHeaderProps) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">SUPER_ADMIN</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
              {title}
            </h1>
            <Badge>{role}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
            {userName
              .split(" ")
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>

          <div>
            <p className="text-sm font-medium text-slate-950">{userName}</p>
            <p className="text-xs text-slate-500">{userEmail}</p>
          </div>
        </div>
      </div>
    </header>
  );
}