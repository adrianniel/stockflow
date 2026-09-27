import type { ShopContext } from "./context";
import type { Expense } from "./types";

type ExpenseRow = {
  id: string;
  expense_date: string;
  name: string;
  amount: string;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  users: { name: string | null } | { name: string | null }[] | null;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function listExpenses(
  { supabase, shopId }: ShopContext,
  options: { from?: string; to?: string } = {},
): Promise<Expense[]> {
  let query = supabase
    .from("expenses")
    .select(
      `id, expense_date, name, amount, notes, created_by, created_at, updated_at, users ( name )`,
    )
    .eq("shop_id", shopId)
    .is("deleted_at", null)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (options.from) {
    query = query.gte("expense_date", options.from);
  }

  if (options.to) {
    query = query.lt("expense_date", options.to);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as ExpenseRow[]).map((row) => ({
    id: row.id,
    expense_date: row.expense_date,
    name: row.name,
    amount: row.amount,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by_name: first(row.users)?.name ?? null,
  }));
}
