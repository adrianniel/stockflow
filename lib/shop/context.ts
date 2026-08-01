import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, requireSession } from "@/lib/auth/guards";
import type { SessionProfile, UserRole } from "@/lib/auth/roles";

/**
 * Resolving the acting user and their shop for a write.
 *
 * Every server action starts here. The point is that `shop_id` is *derived from
 * the session*, never accepted from the request: a hidden form field naming a
 * shop is something the client controls, and trusting one would let a signed-in
 * user of shop A insert rows into shop B. RLS would reject most of that, but the
 * application should not be sending the attempt in the first place — and
 * `created_by` has no RLS to protect it at all.
 *
 * A user whose profile has no `shop_id` cannot write shop data. That is the
 * SUPER_ADMIN case (SRS 5.1 keeps the platform operator out of business data)
 * and also the not-yet-provisioned case, and both are refused here rather than
 * left to fail confusingly further down.
 */

export type ShopContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  /** `users.id`, for created_by / adjusted_by. Not the auth id. */
  userId: string;
  shopId: string;
  role: UserRole;
};

export class NoShopError extends Error {
  constructor() {
    super("Your account is not assigned to a shop.");
    this.name = "NoShopError";
  }
}

/** Shop context for the signed-in user, restricted to `allowed` roles. */
export async function getShopContext(
  ...allowed: UserRole[]
): Promise<ShopContext> {
  const profile =
    allowed.length > 0 ? await requireRole(...allowed) : await requireSession();

  return shopContextFor(profile);
}

/**
 * Builds the context from an already-resolved profile.
 *
 * Pages have usually called requireRole() for their own guard already; this lets
 * them reuse that result instead of round-tripping to auth a second time.
 */
export async function shopContextFor(
  profile: SessionProfile,
): Promise<ShopContext> {
  if (!profile.shop_id) {
    throw new NoShopError();
  }

  return {
    supabase: await createSupabaseServerClient(),
    userId: profile.id,
    shopId: profile.shop_id,
    role: profile.role,
  };
}
