type CompactStatCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
};

export function CompactStatCard({
  label,
  value,
  detail,
  tone = "neutral",
}: CompactStatCardProps) {
  const valueColor =
    tone === "warning"
      ? "text-amber-700"
      : tone === "positive"
        ? "text-emerald-700"
        : "text-[#07152e]";

  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-2.5 shadow-[0_6px_20px_rgba(15,23,42,0.04)] sm:rounded-2xl sm:px-4 sm:py-3">
      <p className="truncate text-[0.58rem] font-semibold uppercase leading-4 tracking-[0.08em] text-slate-500 sm:text-xs sm:tracking-[0.12em]">
        {label}
      </p>
      <p
        title={value}
        className={`mt-1 truncate text-xs font-bold tracking-tight sm:text-lg ${valueColor}`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[0.6rem] leading-4 text-slate-500 sm:text-xs">
        {detail}
      </p>
    </article>
  );
}
