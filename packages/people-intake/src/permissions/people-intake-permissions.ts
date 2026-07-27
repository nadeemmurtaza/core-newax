export const PEOPLE_INTAKE_PERMISSIONS = {
  view: 'people_intake.view',
  create: 'people_intake.create',
  update: 'people_intake.update',
  submit: 'people_intake.submit',
  review: 'people_intake.review',
} as const;

export type PeopleIntakePermission =
  (typeof PEOPLE_INTAKE_PERMISSIONS)[keyof typeof PEOPLE_INTAKE_PERMISSIONS];
