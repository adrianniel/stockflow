import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole, UserStatus } from "@/lib/auth/roles";

/**
 * Reads for the platform administrator (SRS 5.1, 6.2).
 *
 * These deliberately do not go through lib/shop/context.ts: a SUPER_ADMIN has no
 * `shop_id`, so there is no shop to scope to, and every query here is meant to
 * span all shops. That is the one role for which crossing shop boundaries is the
 * point.
 *
 * The boundary that still holds is *what* it may cross into. Migration
 * 20260801120400 removed the super-admin bypass from every business table, so
 * these queries can only reach `shops` and `users`. Adding a select on products,
 * sales, or stock here would return nothing — by design, not by accident.
 */

export type AdminShop = {
  id: string;
  shop_name: string;
  owner_name: string | null;
  status: UserStatus;
  default_interest_percentage: string;
  created_at: string | null;
  /** Members of this shop, counted from the users table. */
  ownerCount: number;
  assistantCount: number;
};

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  shop_id: string | null;
  created_at: string | null;
  /** Null for a SUPER_ADMIN, who belongs to no shop. */
  shopName: string | null;
  isSelf: boolean;
};

type ShopRow = {
  id: string;
  shop_name: string;
  owner_name: string | null;
  status: UserStatus;
  default_interest_percentage: string;
  created_at: string | null;
};

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  shop_id: string | null;
  created_at: string | null;
  shops: { shop_name: string } | Array<{ shop_name: string }> | null;
};

/**
 * Every shop with its headcount.
 *
 * The counts come from one pass over `users` rather than a per-shop aggregate
 * query, so the page costs two round trips regardless of how many shops exist.
 */
export async function listShops(): Promise<AdminShop[]> {
  const supabase = await createSupabaseServerClient();

  const [shopsResult, usersResult] = await Promise.all([
    supabase
      .from("shops")
      .select(
        "id, shop_name, owner_name, status, default_interest_percentage, created_at",
      )
      .order("status")
      .order("shop_name"),
    supabase.from("users").select("shop_id, role, status"),
  ]);

  if (shopsResult.error) {
    throw shopsResult.error;
  }

  if (usersResult.error) {
    throw usersResult.error;
  }

  const owners = new Map<string, number>();
  const assistants = new Map<string, number>();

  for (const member of usersResult.data ?? []) {
    if (!member.shop_id || member.status !== "ACTIVE") {
      continue;
    }

    const bucket = member.role === "OWNER" ? owners : assistants;

    if (member.role === "OWNER" || member.role === "ASSISTANT") {
      bucket.set(member.shop_id, (bucket.get(member.shop_id) ?? 0) + 1);
    }
  }

  return ((shopsResult.data ?? []) as ShopRow[]).map((shop) => ({
    ...shop,
    ownerCount: owners.get(shop.id) ?? 0,
    assistantCount: assistants.get(shop.id) ?? 0,
  }));
}

/** Shop id and name only, for the "assign to shop" select. */
export async function listShopOptions(): Promise<
  Array<{ id: string; shop_name: string }>
> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("shops")
    .select("id, shop_name")
    .eq("status", "ACTIVE")
    .order("shop_name");

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Every account on the platform, with the shop it belongs to.
 *
 * `currentUserId` is the caller's `users.id`, used to mark their own row so the
 * UI can refuse to let them deactivate the account they are signed in with.
 */
export async function listAllUsers(
  currentUserId: string,
): Promise<AdminUser[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("users")
    .select(
      `id, name, email, role, status, shop_id, created_at, shops ( shop_name )`,
    )
    .order("status")
    .order("role")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as UserRow[]).map((row) => {
    const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      shop_id: row.shop_id,
      created_at: row.created_at,
      shopName: shop?.shop_name ?? null,
      isSelf: row.id === currentUserId,
    };
  });
}
