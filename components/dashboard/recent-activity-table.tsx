type ActivityRow = {
  actor: string;
  action: string;
  detail: string;
  time: string;
};

type RecentActivityTableProps = {
  rows: ActivityRow[];
};

export function RecentActivityTable({ rows }: RecentActivityTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 bg-white">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Actor
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Activity
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Detail
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => (
            <tr key={`${row.actor}-${row.time}`} className="hover:bg-slate-50/80">
              <td className="px-4 py-4 text-sm font-medium text-slate-950">
                {row.actor}
              </td>
              <td className="px-4 py-4 text-sm text-slate-600">{row.action}</td>
              <td className="px-4 py-4 text-sm text-slate-600">{row.detail}</td>
              <td className="px-4 py-4 text-sm text-slate-500">{row.time}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}