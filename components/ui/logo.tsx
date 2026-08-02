import Image from "next/image";

import { cn } from "@/lib/utils/cn";

/**
 * The StockFlow mark, used in the sidebar, on the login card, and on the
 * landing page.
 *
 * The source PNG has no alpha channel — it is RGB with a solid white
 * background — so it cannot sit directly on a coloured surface without showing
 * a white square. It is therefore always mounted on a white tile with the same
 * border and radius as the rest of the UI, which reads as deliberate rather
 * than as a transparency bug. Changing the tile to a dark colour will look
 * broken until the logo is re-exported with transparency.
 */

export type LogoSize = "sm" | "md" | "lg";

/**
 * Tile size and the pixel width handed to next/image. The rendered image is
 * requested at roughly 2x the CSS box so it stays sharp on retina screens; the
 * 1254px source is far larger than any of these, so all three are downscales.
 */
const SIZES: Record<LogoSize, { box: string; pixels: number }> = {
  sm: { box: "h-9 w-9 rounded-xl", pixels: 72 },
  md: { box: "h-11 w-11 rounded-2xl", pixels: 96 },
  lg: { box: "h-14 w-14 rounded-2xl", pixels: 128 },
};

type LogoProps = {
  size?: LogoSize;
  className?: string;
  /**
   * Set on the largest above-the-fold instance (the login card) so the mark is
   * not lazy-loaded into a layout shift. Leave false everywhere else.
   */
  priority?: boolean;
};

export function Logo({ size = "md", className, priority = false }: LogoProps) {
  const { box, pixels } = SIZES[size];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-slate-200 bg-white shadow-sm",
        box,
        className,
      )}
    >
      <Image
        src="/stockflow-logo.png"
        alt=""
        width={pixels}
        height={pixels}
        priority={priority}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

type WordmarkProps = {
  size?: LogoSize;
  /** The line under "StockFlow". Omit for the compact form. */
  tagline?: string;
  className?: string;
  priority?: boolean;
};

/**
 * The mark plus the "StockFlow" name.
 *
 * The alt text lives on the visible text rather than the image: the name is
 * already readable to a screen reader here, so labelling the image too would
 * announce it twice.
 */
export function Wordmark({
  size = "md",
  tagline,
  className,
  priority = false,
}: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <Logo size={size} priority={priority} />

      <span className="min-w-0">
        <span className="block text-sm font-semibold tracking-tight text-slate-950">
          StockFlow
        </span>
        {tagline ? (
          <span className="block truncate text-xs text-slate-500">{tagline}</span>
        ) : null}
      </span>
    </span>
  );
}
