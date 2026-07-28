import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parsePreventionIssueNumbers,
  parsePreventionPackReferences,
  parseResolvedMistakes,
} from './prevention-history-parser.mjs';

const block = (body) => `<!-- newax-prevention-event\n${body}\n-->`;

test('parses a structured resolved mistake event', () => {
  const [mistake] = parseResolvedMistakes({
    number: 10,
    body: block(
      [
        'event-id: PREV-EVENT-10',
        'root-cause-id: ROOT-X',
        'ledger-entry: EL-0010',
        'category: formatting',
        'status: closed',
        'root-cause-status: confirmed',
        'resolution-status: verified',
        'resolved-at: 2026-07-17T12:00:00Z',
        `fix-commit: ${'a'.repeat(40)}`,
        'reviewer: reviewer',
        'reviewed-at: 2026-07-17T12:05:00Z',
        'verification-refs: workflow:1',
        'regression-refs: test:one',
        'prevention-control: Require regression evidence.',
      ].join('\n'),
    ),
  });
  assert.equal(mistake.rootCauseId, 'ROOT-X');
  assert.deepEqual(mistake.regressionRefs, ['test:one']);
});

test('parses legacy learning issue resolution fields without inventing missing evidence', () => {
  const [mistake] = parseResolvedMistakes({
    number: 11,
    state: 'closed',
    closed_at: '2026-07-17T12:00:00Z',
    body: `<!-- newax-engineering-event\nroot-cause-id: ROOT-LEGACY\nfailure-category: formatting\nroot-cause-status: confirmed\n-->\n## Resolution record\n\n- Root-cause status: \`confirmed\`\n- Resolution status: \`verified\`\n- Fix commit: \`${'b'.repeat(40)}\`\n- Successful verification: workflow:2\n- Reviewer confirmation: reviewer\n- Ledger entry: \`EL-0011\``,
  });
  assert.equal(mistake.rootCauseId, 'ROOT-LEGACY');
  assert.equal(mistake.reviewedAt, '');
  assert.deepEqual(mistake.regressionRefs, []);
});

test('does not convert ordinary prose into a resolved mistake', () => {
  assert.deepEqual(parseResolvedMistakes({ number: 12, body: 'We learned a lot.' }), []);
});

test('parses prevention and learning issue references from pull request metadata', () => {
  const body = '- Prevention records: `#10`\n- Learning issues: `#11, #12`';
  assert.deepEqual(parsePreventionIssueNumbers(body), [10, 11, 12]);
});

test('parses declared prevention pack paths', () => {
  const body =
    '<!-- newax-prevention-pack\npaths: .newax/prevention/ci/root-x.json, .newax/prevention/pr-checklists/root-x.md\n-->';
  assert.deepEqual(parsePreventionPackReferences(body), [
    '.newax/prevention/ci/root-x.json',
    '.newax/prevention/pr-checklists/root-x.md',
  ]);
});

test('ignores linked learning issues that are not resolved', () => {
  assert.deepEqual(
    parseResolvedMistakes({
      number: 13,
      state: 'open',
      body: '<!-- newax-engineering-event\nroot-cause-id: ROOT-OPEN\nroot-cause-status: confirmed\n-->',
    }),
    [],
  );
});

test('parses the structured prevention issue form', () => {
  const [mistake] = parseResolvedMistakes({
    number: 14,
    body: `## Event ID
PREV-FORM-14

## Root cause ID
ROOT-FORM

## Ledger entry
EL-0014

## Category
formatting

## Status
Closed

## Root-cause status
Confirmed

## Resolution status
Verified

## Resolved at
2026-07-17T14:00:00Z

## Fix commit
${'c'.repeat(40)}

## Reviewer
reviewer

## Reviewed at
2026-07-17T14:05:00Z

## Verification references
workflow:14

## Regression references
test:form

## Prevention control
Require the form regression.

## Successful method
Parse heading fields.

## Unsuccessful method
Create a form the parser cannot read.

## Evidence references
issue:14

## CI control owner
platform

## CI control reviewer
reviewer

## CI implementation reference
tooling/ci-check.mjs

## CI verification references
workflow:15`,
  });
  assert.equal(mistake.id, 'PREV-FORM-14');
  assert.equal(mistake.rootCauseId, 'ROOT-FORM');
  assert.deepEqual(mistake.verificationRefs, ['workflow:14']);
  assert.equal(mistake.resolutionStatus, 'Verified');
  assert.equal(mistake.controlOptions['ci-check'].owner, 'platform');
  assert.deepEqual(mistake.controlOptions['ci-check'].verificationRefs, ['workflow:15']);
});

test('combines latest structured control ownership by root cause', async () => {
  const { buildPreventionControlOptions } = await import('./prevention-history-parser.mjs');
  const options = buildPreventionControlOptions([
    {
      id: 'E-1',
      rootCauseId: 'ROOT-X',
      resolvedAt: '2026-07-17T10:00:00Z',
      controlOptions: { 'ci-check': { owner: 'old', verificationRefs: [] } },
    },
    {
      id: 'E-2',
      rootCauseId: 'ROOT-X',
      resolvedAt: '2026-07-18T10:00:00Z',
      controlOptions: {
        'ci-check': {
          owner: 'platform',
          reviewer: 'reviewer',
          implementationRef: 'tooling/check.mjs',
          verificationRefs: ['workflow:2'],
        },
      },
    },
  ]);
  assert.equal(options['ROOT-X'].controls['ci-check'].owner, 'platform');
});
