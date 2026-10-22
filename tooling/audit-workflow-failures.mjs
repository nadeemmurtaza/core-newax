import { FAILURE_CONCLUSIONS, isExecutedFailure, listAll } from './engineering-learning-core.mjs';
import { captureWorkflowRunFailure } from './workflow-failure-capture.mjs';

const hours = Number(process.env.ENGINEERING_AUDIT_HOURS ?? '168');
if (!Number.isFinite(hours) || hours <= 0) {
  throw new Error('ENGINEERING_AUDIT_HOURS must be a positive number.');
}

const cutoff = Date.now() - hours * 60 * 60 * 1000;
const runs = await listAll('/actions/runs?status=completed', {
  collectionKey: 'workflow_runs',
});
const recentRuns = runs.filter((run) => {
  const completedAt = Date.parse(run.updated_at ?? run.created_at ?? '');
  return FAILURE_CONCLUSIONS.has(run.conclusion) && completedAt >= cutoff;
});
const executedFailureFlags = await Promise.all(recentRuns.map((run) => isExecutedFailure(run)));
const failedRuns = recentRuns.filter((_run, index) => executedFailureFlags[index]);

const results = [];
for (const run of failedRuns) {
  results.push({ runId: run.id, ...(await captureWorkflowRunFailure(run)) });
}

console.log(
  JSON.stringify({
    inspected: runs.length,
    failedRuns: failedRuns.length,
    windowHours: hours,
    results,
  }),
);
