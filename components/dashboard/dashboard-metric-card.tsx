type MetricGraphic = "sales" | "profit" | "stock" | "products" | "credit";

const BAR_PROFILES: Record<MetricGraphic, number[]> = {
  sales: [35, 57, 44, 82, 64, 100, 73],
  profit: [40, 66, 52, 78, 58, 92, 72],
  stock: [84, 65, 93, 72, 100, 77, 88],
  products: [48, 74, 60, 94, 70, 84, 56],
  credit: [90, 68, 82, 54, 73, 44, 62],
};

const BAR_COLORS: Record<MetricGraphic, string> = {
  sales: "bg-blue-400",
  profit: "bg-emerald-500",
  stock: "bg-sky-600",
  products: "bg-indigo-400",
  credit: "bg-amber-500",
};

type DashboardMetricCardProps = {
  label: string;
  value: string;
  detail: string;
  graphic: MetricGraphic;
};

/** Compact overview KPI with a small, decorative chart motif. */
export function DashboardMetricCard({
  label,
  value,
  detail,
  graphic,
}: DashboardMetricCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.055)] sm:rounded-3xl sm:p-4 lg:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.68rem] font-semibold leading-4 text-slate-600 sm:text-xs sm:leading-5">
          {label}
        </p>
        <span aria-hidden="true" className="mt-0.5 flex h-5 shrink-0 items-end gap-[3px] sm:h-6">
          {BAR_PROFILES[graphic].map((height, index) => (
            <span
              key={index}
              className={`w-[3px] rounded-full ${index < 4 ? "opacity-45" : "opacity-80"} ${BAR_COLORS[graphic]}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </span>
      </div>

      <p className="mt-2 truncate text-xl font-semibold tracking-tight text-[#07152e] sm:mt-3 sm:text-2xl lg:text-[1.7rem]">
        {value}
      </p>
      <p className="mt-1 truncate text-[0.65rem] leading-4 text-slate-500 sm:text-xs sm:leading-5">
        {detail}
      </p>

      <div aria-hidden="true" className="mt-3 flex h-1 gap-1 overflow-hidden rounded-full bg-slate-100 sm:mt-4">
        <span className={`h-full w-2/5 rounded-full ${BAR_COLORS[graphic]} opacity-60`} />
        <span className={`h-full w-1/4 rounded-full ${BAR_COLORS[graphic]} opacity-35`} />
        <span className="h-full flex-1 rounded-full bg-slate-200" />
      </div>
    </article>
  );
}
