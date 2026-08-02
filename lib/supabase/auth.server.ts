import { cache } from "react";

import { isAuthSessionMissingError } from "@supabase/supabase-js";

import type { SessionProfile } from "@/lib/auth/roles";

import { createSupabaseServerClient } from "./server";

/**
 * The signed-in auth user, or null when nobody is signed in.
 *
 * "No session" arrives from supabase-js as an AuthSessionMissingError rather
 * than as a null user, and it is not a failure — it is the ordinary state of an
 * anonymous visitor. Rethrowing it would send every signed-out request to
 * /dashboard into the error boundary with a 500 instead of letting
 * requireSession() redirect to /login.
 *
 * Anything else is still thrown: an unreachable Supabase or a malformed token
 * is a real fault, and silently reporting it as "signed out" would turn an
 * outage into a confusing redirect loop through the login page.
 *
 * Wrapped in React's cache() so it runs once per request rather than once per
 * caller. A single dashboard page load asks for the session from the layout's
 * requireSession(), the page's own requireRole(), getDashboardIdentity(), and
 * generateMetadata() — four round trips to Supabase for an answer that cannot
 * change within one request. The cache is per-request, so a fresh sign-in or a
 * revalidation still sees current data.
 */
export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (isAuthSessionMissingError(error)) {
      return null;
    }

    throw error;
  }

  return user;
});

/**
 * Loads the `users` row backing an auth account.
 *
 * Uses `maybeSingle()` rather than `single()`: an auth account with no matching
 * profile is a real state (invited but not provisioned, or a row deleted out
 * from under a live session), and callers handle `null` by redirecting to
 * /login. `single()` would throw instead and surface as a 500.
 */
export const getUserProfile = cache(async function getUserProfile(
  authId: string,
): Promise<SessionProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("users")
    .select(`
      id,
      name,
      role,
      shop_id,
      status,
      shops ( shop_name, status )
    `)
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as ProfileRow;

  // supabase-js types a to-one embed as either an object or a single-element
  // array depending on how it infers the relationship, so both are handled.
  const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;

  return {
    id: row.id,
    name: row.name,
    role: row.role,
    shop_id: row.shop_id,
    status: row.status,
    shop_status: shop?.status ?? null,
    shop_name: shop?.shop_name ?? null,
  };
});

type ProfileRow = {
  id: string;
  name: string | null;
  role: SessionProfile["role"];
  shop_id: string | null;
  status: SessionProfile["status"];
  shops: {
    shop_name: string | null;
    status: SessionProfile["status"];
  } | Array<{
    shop_name: string | null;
    status: SessionProfile["status"];
  }> | null;
};
