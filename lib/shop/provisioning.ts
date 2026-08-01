import { createClient } from "@supabase/supabase-js";

import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Creating login accounts without the service_role key.
 *
 * The obvious tool for this is the Supabase admin API (`auth.admin.createUser`),
 * and it is deliberately not used: it requires the service_role key, which
 * bypasses RLS entirely. Holding that key anywhere in this project would mean
 * one server-side mistake could read or write every shop's data, which is the
 * single thing the whole RLS design exists to prevent.
 *
 * So accounts are created with the ordinary public `signUp` endpoint, on a
 * throwaway client that is deliberately isolated from the request:
 *
 *   * `persistSession: false` — signUp returns a session for the *new* user. On
 *     a cookie-bound client that session would be written to the response and
 *     the owner would find themselves logged in as the assistant they just
 *     created. This client stores nothing, so the owner's cookies are untouched.
 *   * `autoRefreshToken: false` — nothing here is long-lived enough to refresh,
 *     and a background timer in a server module is a leak.
 *
 * The trade-off is that signUp obeys the project's own auth settings. If email
 * confirmation is enabled, the account exists but cannot sign in until the link
 * is clicked; `requiresConfirmation` reports that so the UI can say so rather
 * than leaving the owner to wonder why the new password does not work.
 */

export type CreatedAccount = {
  authId: string;
  requiresConfirmation: boolean;
};

export class AccountExistsError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "AccountExistsError";
  }
}

export class AccountCreationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountCreationError";
  }
}

/**
 * Registers an auth account and returns its id.
 *
 * Creates nothing in `public.users` — the caller does that with its own
 * cookie-bound client so the insert runs under the caller's RLS policies and
 * their shop, not under some elevated identity.
 */
export async function createAuthAccount(
  email: string,
  password: string,
): Promise<CreatedAccount> {
  const client = createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.signUp({ email, password });

  if (error) {
    // Supabase returns 422 user_already_exists when email confirmation is off.
    // With it on, the duplicate is masked instead — handled below.
    if (
      error.code === "user_already_exists" ||
      error.message.toLowerCase().includes("already registered")
    ) {
      throw new AccountExistsError();
    }

    throw new AccountCreationError(error.message);
  }

  const user = data.user;

  if (!user) {
    throw new AccountCreationError(
      "Supabase did not return an account for that email.",
    );
  }

  // Anti-enumeration: with email confirmation enabled, signing up an address
  // that already exists succeeds and returns a placeholder user with an empty
  // `identities` array, so that an attacker cannot probe which emails are
  // registered. Taking that placeholder at face value would create a `users`
  // row pointing at an auth id that is not the real account, and the new person
  // would never be able to sign in. Treat it as the duplicate it is.
  if (user.identities !== undefined && user.identities.length === 0) {
    throw new AccountExistsError();
  }

  return {
    authId: user.id,
    // A session comes back only when the account is immediately usable.
    requiresConfirmation: data.session === null,
  };
}
