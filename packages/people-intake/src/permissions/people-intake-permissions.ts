export const PEOPLE_INTAKE_PERMISSIONS = {
  view: 'people_intake.view',
  create: 'people_intake.create',
  update: 'people_intake.update',
  submit: 'people_intake.submit',
  review: 'people_intake.review',
  evidenceView: 'people_intake.evidence.view',
  evidenceAttach: 'people_intake.evidence.attach',
  certificateExtract: 'people_intake.certificate_import.extract',
  certificateReview: 'people_intake.certificate_import.review',
  certificateApply: 'people_intake.certificate_import.apply',
} as const;

export type PeopleIntakePermission =
  (typeof PEOPLE_INTAKE_PERMISSIONS)[keyof typeof PEOPLE_INTAKE_PERMISSIONS];
