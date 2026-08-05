type StatCardProps = {
  label: string;
  value: string;
  delta: string;
};

export function StatCard({ label, value, delta }: StatCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      {/*
        Wraps rather than switching layout at a breakpoint.

        A peso figure has no spaces, so it cannot reflow: sat next to the delta
        chip in a narrow card it simply runs past the edge. A breakpoint would
        be guesswork here because the card is not narrowest on a phone — the
        grids these sit in go to two columns at sm and four at xl, so the tight
        cases are spread across the whole range. Letting the chip wrap to its
        own line handles all of them, and changes nothing at any width where
        the two already fit side by side.
      */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
          {value}
        </h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {delta}
        </span>
      </div>
    </article>
  );
}