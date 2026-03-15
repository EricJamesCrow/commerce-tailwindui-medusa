/**
 * Simple class name utility for email templates.
 * Email templates don't need tailwind-merge, just basic concatenation.
 */
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
