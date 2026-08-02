"use client";

/**
 * The last-resort boundary: catches errors thrown in the root layout itself,
 * where the normal error boundary has no chrome left to render into.
 *
 * This one replaces the whole document, which is why it declares its own
 * <html> and <body>. It also cannot rely on the app's fonts or globals having
 * loaded — that is exactly the failure it may be catching — so the styling
 * here is inline and deliberately independent of Tailwind and of the Logo
 * component. Every other error screen should look like the app; this one only
 * has to work.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f1f5f9",
          color: "#0f172a",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "1rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "32rem",
            borderRadius: "1.5rem",
            border: "1px solid #e2e8f0",
            backgroundColor: "#ffffff",
            padding: "2rem",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            StockFlow could not start
          </h1>

          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            Something failed before the page could be built. The problem was
            logged. If it keeps happening, send the reference code below to
            whoever maintains this system.
          </p>

          {error.digest ? (
            <p
              style={{
                marginTop: "1rem",
                borderRadius: "1rem",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                padding: "0.75rem 1rem",
                fontSize: "0.75rem",
                color: "#64748b",
              }}
            >
              Reference code{" "}
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontWeight: 500,
                  color: "#334155",
                }}
              >
                {error.digest}
              </span>
            </p>
          ) : null}

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              borderRadius: "1rem",
              border: "none",
              backgroundColor: "#020617",
              color: "#ffffff",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
