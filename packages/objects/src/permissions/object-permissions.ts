export const OBJECT_PERMISSIONS = {
  create: 'objects.create',
  typesManage: 'objects.types.manage',
  view: 'objects.view',
} as const;

export type ObjectPermission = (typeof OBJECT_PERMISSIONS)[keyof typeof OBJECT_PERMISSIONS];
