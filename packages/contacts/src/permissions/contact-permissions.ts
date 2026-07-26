export const CONTACT_PERMISSIONS = {
  create: 'contacts.create',
  remove: 'contacts.remove',
  update: 'contacts.update',
  view: 'contacts.view',
} as const;

export type ContactPermission = (typeof CONTACT_PERMISSIONS)[keyof typeof CONTACT_PERMISSIONS];
