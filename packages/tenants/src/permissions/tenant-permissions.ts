export const TENANT_PERMISSIONS = {
  create: 'tenants.create',
  view: 'tenants.view',
} as const;

export type TenantPermission = (typeof TENANT_PERMISSIONS)[keyof typeof TENANT_PERMISSIONS];
