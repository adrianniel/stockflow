import { getSupabaseBrowserClient } from "./client";

/**
 * Browser-side auth helpers.
 *
 * Nothing here logs the Supabase response: `signInWithPassword` resolves with a
 * full session object containing the access and refresh tokens, and printing it
 * puts those tokens in the browser console where any extension can read them.
 */

export async function signIn(email: string, password: string) {
  const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await getSupabaseBrowserClient().auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await getSupabaseBrowserClient().auth.getUser();

  return user;
}

/**
 * Changes the signed-in user's password (SRS 6.1).
 *
 * Supabase requires a live session for this; it does not take the old password,
 * so callers that want re-authentication must do it separately.
 */
export async function changePassword(newPassword: string) {
  const { error } = await getSupabaseBrowserClient().auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }
}
