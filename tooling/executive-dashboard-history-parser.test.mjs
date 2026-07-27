import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeExecutiveDashboardEvidence,
  parseExecutiveDashboardEvidence,
} from './executive-dashboard-history-parser.mjs';

test('parses explicit metric records', () => {
  const body = `<!-- newax-executive-metric
type: cost
id: c1
category: planning
amount-minor: 120000
currency: PKR
status: verified
at: 2026-07-01T00:00:00Z
source-refs: invoice:1
-->
<!-- newax-executive-metric
type: time-loss
id: t1
category: planning
minutes: 90
status: estimated
at: 2026-07-01T00:00:00Z
source-refs: estimate:1
-->`;
  const parsed = parseExecutiveDashboardEvidence(body, { source: 'issue:1', issueNumber: 1 });
  assert.equal(parsed.costRecords.length, 1);
  assert.equal(parsed.timeLossRecords[0].minutes, 90);
});

test('parses existing engineering, recurrence, confidence and AI records', () => {
  const recurrence = JSON.stringify({
    digest: 'd1',
    rootCauseId: 'ROOT-X',
    state: 'detected',
    escalation: 'warning',
    currentOccurrence: { id: 'o1', occurredAt: '2026-07-01T00:00:00Z', prNumber: 7 },
    previousPrNumbers: [3],
    rule: { id: 'r' },
    explanation: { disposition: 'not-executed' },
  });
  const confidence = JSON.stringify({
    findingId: 'f1',
    envelope: { evidenceQuality: { score: 88 } },
  });
  const body = `<!-- newax-engineering-event
root-cause-id: ROOT-X
root-cause-status: confirmed
failure-category: planning
occurred-at: 2026-07-01T00:00:00Z
source-id: src
-->
<!-- newax-recurrence-decision
${recurrence}
-->
<!-- newax-confidence-score
${confidence}
-->
<!-- newax-ai-quality-event
event: validation
event-id: ai1
validation-code: incorrect
reviewer: human
at: 2026-07-02T00:00:00Z
validation-ref: review:1
-->`;
  const parsed = parseExecutiveDashboardEvidence(body, { source: 'issue:7', issueNumber: 7 });
  assert.equal(parsed.occurrences[0].rootCauseId, 'ROOT-X');
  assert.equal(parsed.recurrenceDecisions[0].ruleId, 'r');
  assert.equal(parsed.confidenceRecords[0].evidenceQualityScore, 88);
  assert.equal(parsed.aiRecords[0].outcome, 'incorrect');
});

test('ordinary prose creates no evidence', () => {
  const parsed = parseExecutiveDashboardEvidence('Cost was high.', { source: 'issue:1' });
  assert.equal(Object.values(parsed).flat().length, 0);
});

test('explicit review outcome supersedes coverage-only record', () => {
  const merged = mergeExecutiveDashboardEvidence([
    { reviewRecords: [{ id: 'coverage', prNumber: 5, reviewed: true, validFindings: null }] },
    { reviewRecords: [{ id: 'exact', prNumber: 5, reviewed: true, validFindings: 2 }] },
  ]);
  assert.equal(merged.reviewRecords[0].validFindings, 2);
});
