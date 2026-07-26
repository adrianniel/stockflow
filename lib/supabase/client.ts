import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://awxphxckzcqxmcgixefk.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3eHBoeGNremNxeG1jZ2l4ZWZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTYxNDgsImV4cCI6MjEwMDU3MjE0OH0.F5e6hZPOFruLo3wzPD4WQlLJ8NTV9dPh143bcCCNhfM";

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);