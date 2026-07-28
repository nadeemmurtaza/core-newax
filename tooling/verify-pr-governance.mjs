import { readFileSync } from 'node:fs';

import { parsePullRequestField } from './engineering-learning-core.mjs';

const REQUIRED_HEADINGS = [
  '## Scope',
  '## Acceptance criteria',
  '## Verification',
  '## Engineering learning record',
  '## Repository freeze and evidence',
  '## Known issues',
  '## Merge policy',
];

const REQUIRED_FIELDS = [
  '- Ledger entries:',
  '- Learning issues:',
  '- Root-cause status:',
  '- Root-cause evidence:',
  '- Resolution evidence:',
  '- Successful method used:',
  '- Unsuccessful method avoided:',
  '- New prevention control:',
  '- Ledger consulted before implementation:',
  '- Failure history reconciled:',
  '- External and tool events reconciled:',
  '- Head commit:',
  '- Exact-head CI:',
  '- Repository-content freeze:',
  '- Source file contains the workflow run that verifies itself:',
  '- Repository file action used for pull-request metadata:',
];

function fail(messages) {
  console.error('Pull-request governance validation failed:');
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (eventPath === undefined || eventPath.length === 0) {
  fail(['GITHUB_EVENT_PATH is unavailable.']);
}

const event = JSON.parse(readFileSync(eventPath, 'utf8'));
const body = event.pull_request?.body ?? '';
const errors = [];

for (const heading of REQUIRED_HEADINGS) {
  if (!body.includes(heading)) {
    errors.push(`Missing required heading: ${heading}`);
  }
}

for (const field of REQUIRED_FIELDS) {
  if (!body.includes(field)) {
    errors.push(`Missing required field: ${field}`);
  }
}

const manualLearningOutcome = parsePullRequestField(body, '- Learning outcome:');
const rootCauseStatus = parsePullRequestField(body, '- Root-cause status:');
const ledgerConsulted = parsePullRequestField(body, '- Ledger consulted before implementation:');
const failureHistoryReconciled = parsePullRequestField(body, '- Failure history reconciled:');
const externalEventsReconciled = parsePullRequestField(
  body,
  '- External and tool events reconciled:',
);
const sourceSelfReference = parsePullRequestField(
  body,
  '- Source file contains the workflow run that verifies itself:',
);
const wrongMetadataAction = parsePullRequestField(
  body,
  '- Repository file action used for pull-request metadata:',
);

if (manualLearningOutcome !== null) {
  errors.push(
    'Remove the `Learning outcome` field. The trusted rule engine calculates `required` or `not-required`; an author cannot choose `none`.',
  );
}

if (!['confirmed', 'machine-supported', 'not-required'].includes(rootCauseStatus ?? '')) {
  errors.push('Root-cause status must be `confirmed`, `machine-supported`, or `not-required`.');
}

if (ledgerConsulted !== 'yes') {
  errors.push('The engineering learning ledger must be consulted before implementation.');
}
if (failureHistoryReconciled !== 'yes') {
  errors.push('Failure history must be reconciled before review.');
}
if (externalEventsReconciled !== 'yes') {
  errors.push('External and tool events must be reconciled before review.');
}
if (sourceSelfReference !== 'no') {
  errors.push('Source files must not contain the workflow run that verifies themselves.');
}
if (wrongMetadataAction !== 'no') {
  errors.push('Repository file actions must not be used for pull-request metadata.');
}

if (errors.length > 0) {
  fail(errors);
}

console.log(
  'Pull-request governance record is structurally valid; learning outcome is machine-evaluated.',
);
