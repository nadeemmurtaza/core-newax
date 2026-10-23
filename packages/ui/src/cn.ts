export type ClassValue = string | false | null | undefined;

/** Joins class names, dropping falsy values. The one class-merge utility every NEWAX surface imports. */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}
