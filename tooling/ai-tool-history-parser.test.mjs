import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAiQualityEvents, parseAiQualityIssueNumbers } from './ai-tool-history-parser.mjs';

const marker = (body) => `<!-- newax-ai-quality-event\n${body}\n-->`;

test('parses structured AI quality markers', () => {
  const [event] = parseAiQualityEvents(
    marker(
      [
        'event-id: AIQ-EVENT-1',
        'event: ai-output',
        'output-id: OUT-1',
        'provider: example-provider',
        'output-hash: ' + 'a'.repeat(64),
        'artifact-refs: tooling/example.mjs, tooling/example.test.mjs',
      ].join('\n'),
    ),
    { source: 'issue:1', createdAt: '2026-07-17T10:00:00Z' },
  );
  assert.equal(event.id, 'AIQ-EVENT-1');
  assert.equal(event.outputId, 'OUT-1');
  assert.deepEqual(event.artifactRefs, ['tooling/example.mjs', 'tooling/example.test.mjs']);
  assert.equal(event.source, 'issue:1');
});

test('parses the structured issue form', () => {
  const [event] = parseAiQualityEvents(
    `## Event ID\nAIQ-EVENT-2\n\n## Event type\npolicy-violation\n\n## Output ID\nOUT-2\n\n## Policy ID\nPOLICY-1\n\n## Validation reference\nreview:22`,
  );
  assert.equal(event.id, 'AIQ-EVENT-2');
  assert.equal(event.type, 'policy-violation');
  assert.equal(event.policyId, 'POLICY-1');
  assert.equal(event.validationRef, 'review:22');
});

test('parses grouped issue-form evidence fields', () => {
  const [event] = parseAiQualityEvents(`## Event ID
AIQ-EVENT-3

## Event type
AI output

## Output ID
OUT-3

## Status
verified

## Output provenance
Provider: example-provider
Model: example-model
Output hash: ${'c'.repeat(64)}
Artifact references: tooling/example.mjs
Generated: Yes

## Version and symbol evidence
Framework: next
Framework version: 16.2.10
Symbol: oldApi`);
  assert.equal(event.type, 'ai-output');
  assert.equal(event.provider, 'example-provider');
  assert.equal(event.model, 'example-model');
  assert.equal(event.outputHash, 'c'.repeat(64));
  assert.deepEqual(event.artifactRefs, ['tooling/example.mjs']);
  assert.equal(event.framework, 'next');
  assert.equal(event.frameworkVersion, '16.2.10');
  assert.equal(event.generated, 'Yes');
});

test('does not convert ordinary prose into evidence', () => {
  assert.deepEqual(parseAiQualityEvents('The AI probably hallucinated an API.'), []);
});

test('parses linked AI quality issues from the pull request field', () => {
  const body = '## AI and tool quality evidence\n\n- AI quality issues: `#233, #234`';
  assert.deepEqual(parseAiQualityIssueNumbers(body), [233, 234]);
});
