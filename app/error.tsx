"use client";

import { ErrorCard } from "@/components/ui/error-card";

/**
 * Root error boundary — catches anything thrown outside /dashboard, which in
 * practice means the landing page and the login route.
 *
 * "Back to dashboard" is hidden here: a visitor who hits an error on / or
 * /login is usually not signed in, and offering them a link that will bounce
 * them back to /login is worse than offering nothing.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4 text-slate-950">
      <ErrorCard digest={error.digest} onRetry={reset} showHomeLink={false} />
    </main>
  );
}
