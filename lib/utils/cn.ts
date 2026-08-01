/**
 * Minimal class-name joiner.
 *
 * Kept dependency-free on purpose: the dashboard composes Tailwind strings by
 * hand and never needs conditional-class merging beyond dropping falsy values.
 */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
