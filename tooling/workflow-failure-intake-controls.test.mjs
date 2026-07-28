import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSafeWorkflowSymptom,
  extractMonitoredWorkflowNames,
  extractWorkflowName,
  findWorkflowCoverageErrors,
  limitWorkflowLog,
} from './workflow-failure-intake-controls.mjs';

test('limits classification logs from the end where failing output normally appears', () => {
  assert.equal(limitWorkflowLog('0123456789', 4), '6789');
  assert.equal(limitWorkflowLog('short', 10), 'short');
});

test('rejects invalid classification log limits', () => {
  assert.throws(() => limitWorkflowLog('text', 0), /positive safe integer/);
});

test('creates a safe symptom without copying raw logs', () => {
  const symptom = createSafeWorkflowSymptom({
    workflowName: 'Continuous Integration',
    jobName: 'Verify monorepo',
    stepName: 'Install dependencies',
    matchedSignatures: ['ERR_PNPM_OUTDATED_LOCKFILE', 'ERR_PNPM_OUTDATED_LOCKFILE'],
  });

  assert.equal(
    symptom,
    'Continuous Integration / Verify monorepo / Install dependencies failed (ERR_PNPM_OUTDATED_LOCKFILE). Review the linked workflow logs; raw log content is not copied into this issue.',
  );
  assert.equal(symptom.includes('Authorization:'), false);
});

test('extracts quoted and unquoted workflow names', () => {
  assert.equal(
    extractWorkflowName('name: Continuous Integration\non: push\n'),
    'Continuous Integration',
  );
  assert.equal(
    extractWorkflowName("name: 'Database Registry Map'\non: push\n"),
    'Database Registry Map',
  );
});

test('extracts the workflow_run monitoring list', () => {
  const names = extractMonitoredWorkflowNames(
    `on:\n  workflow_run:\n    workflows:\n      - Continuous Integration\n      - 'Database Registry Map'\n    types:\n      - completed\n`,
  );

  assert.deepEqual(names, ['Continuous Integration', 'Database Registry Map']);
});

test('detects a current workflow omitted from failure intake', () => {
  const workflowFiles = [
    { filename: 'ci.yml', content: 'name: Continuous Integration\n' },
    { filename: 'database.yml', content: 'name: Database Registry Map\n' },
    {
      filename: 'engineering-failure-intake.yml',
      content: 'name: Engineering Failure Intake\n',
    },
  ];
  const errors = findWorkflowCoverageErrors({
    workflowFiles,
    intakeContent: `on:\n  workflow_run:\n    workflows:\n      - Continuous Integration\n      - Future Workflow\n`,
  });

  assert.deepEqual(errors, [
    'Workflow Database Registry Map (database.yml) is not monitored by engineering-failure-intake.yml.',
  ]);
});

test('accepts complete coverage and harmless future workflow registration', () => {
  const workflowFiles = [
    { filename: 'ci.yml', content: 'name: Continuous Integration\n' },
    { filename: 'database.yml', content: 'name: Database Registry Map\n' },
    {
      filename: 'engineering-failure-intake.yml',
      content: 'name: Engineering Failure Intake\n',
    },
  ];
  const errors = findWorkflowCoverageErrors({
    workflowFiles,
    intakeContent: `on:\n  workflow_run:\n    workflows:\n      - Continuous Integration\n      - Database Registry Map\n      - Future Workflow\n`,
  });

  assert.deepEqual(errors, []);
});
