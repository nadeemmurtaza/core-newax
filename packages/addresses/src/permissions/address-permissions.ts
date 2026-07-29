export const ADDRESS_PERMISSIONS = {
  create: 'addresses.create',
  update: 'addresses.update',
  view: 'addresses.view',
} as const;

export type AddressPermission = (typeof ADDRESS_PERMISSIONS)[keyof typeof ADDRESS_PERMISSIONS];
