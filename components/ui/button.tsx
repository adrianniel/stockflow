import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-slate-950 text-white hover:bg-slate-800 shadow-sm",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
  danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
};

function classesFor(variant: ButtonVariant, size: ButtonSize, extra?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classesFor(variant, size, className)}
      {...props}
    />
  );
}

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/** A link styled as a button — used for "New product", "Back", and similar. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={classesFor(variant, size, className)}>
      {children}
    </Link>
  );
}
