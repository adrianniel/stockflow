import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  /** A "Create the first one" button, when the user is allowed to create one. */
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
