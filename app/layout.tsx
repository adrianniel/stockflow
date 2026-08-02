import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * `%s | StockFlow` lets a page set just its own name via `title` and get the
 * product name appended; the landing page overrides it with `absolute`.
 *
 * The icon is app/icon.png, which Next.js picks up by filename — no `icons`
 * entry is needed here.
 */
export const metadata: Metadata = {
  title: {
    default: "StockFlow",
    template: "%s | StockFlow",
  },
  description:
    "Inventory and sales management for small auto parts shops. Track stock batches, prices, and profit.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)] antialiased">
        {children}
      </body>
    </html>
  );
}
