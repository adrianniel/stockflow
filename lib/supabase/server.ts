import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://awxphxckzcqxmcgixefk.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3eHBoeGNremNxeG1jZ2l4ZWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTYxNDgsImV4cCI6MjEwMDU3MjE0OH0.F5e6hZPOFruLo3wzPD4WQlLJ8NTV9dPh143bcCCNhfM";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            (cookieStore as any).set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies; the proxy keeps them fresh.
        }
      },
    },
  });
}