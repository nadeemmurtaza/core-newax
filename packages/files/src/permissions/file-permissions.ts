export const FILE_PERMISSIONS = {
  register: 'files.register',
  view: 'files.view',
} as const;

export type FilePermission = (typeof FILE_PERMISSIONS)[keyof typeof FILE_PERMISSIONS];
