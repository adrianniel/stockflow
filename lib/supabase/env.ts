/**
 * Single source of truth for Supabase connection settings.
 *
 * Reading `process.env` directly in each client file invited hardcoded
 * fallbacks, which put real credentials into git history. Centralising it here
 * means a missing variable fails loudly at the point of use instead of silently
 * connecting to the wrong project.
 *
 * These are functions rather than module-level constants on purpose. As
 * constants they ran at import time, so `next build` crashed while collecting
 * page data on any machine without a populated .env.local — a build that needs
 * no database in order to compile. Resolving them lazily keeps the loud failure
 * for anyone who actually tries to talk to Supabase without configuration,
 * while letting the build run offline.
 *
 * Both variables are NEXT_PUBLIC_ because the browser client needs them. The
 * publishable (anon) key is safe to ship to the browser — RLS is what protects
 * the data. The service_role key must never appear in this file.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        `Copy .env.example to .env.local and fill in your Supabase project values.`,
    );
  }

  return value;
}

export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
