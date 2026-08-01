import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * The browser Supabase client.
 *
 * Created on first use rather than at import time so that importing this module
 * during a build — which Next.js does when it compiles any client component
 * that reaches auth — does not require the environment to be configured. The
 * instance is cached, because @supabase/ssr expects one client per browser
 * context: a second one would keep its own copy of the session and the two
 * would drift after a token refresh.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl(), supabasePublishableKey());
  }

  return browserClient;
}
