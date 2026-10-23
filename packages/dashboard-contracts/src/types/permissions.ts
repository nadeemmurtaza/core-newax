/**
 * A required permission a widget or service needs -- the same shape
 * `RequirePermissions` / `ORGANIZATION_PERMISSIONS` already use
 * (packages/organizations, apps/api/src/http-security). Dashboard
 * contracts don't invent a second permission system; they reference
 * codes from the existing one. Hiding a widget because the viewer lacks
 * this permission is presentation only -- the data adapter's own backend
 * endpoint must independently enforce it (see README's "Backend
 * authorization is mandatory" note).
 */
export type PermissionCode = string;

const PERMISSION_CODE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u;

export function isValidPermissionCode(value: unknown): value is PermissionCode {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 160 &&
    PERMISSION_CODE_PATTERN.test(value)
  );
}
