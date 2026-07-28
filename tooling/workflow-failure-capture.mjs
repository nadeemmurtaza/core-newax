import {
  FAILURE_CONCLUSIONS,
  createEngineeringEvent,
  githubRequest,
  listAll,
} from './engineering-learning-core.mjs';
import { submitEngineeringEvent } from './submit-engineering-event.mjs';
import {
  createSafeWorkflowSymptom,
  limitWorkflowLog,
} from './workflow-failure-intake-controls.mjs';

// These "Verify engineering learning record" steps fail only when the pull
// request's own governance bookkeeping (linked-issue list, planning-issue
// link, record structure) has not yet caught up with a previous capture from
// this same job — not when the code under review has a real defect. Capturing
// them produces a self-referential loop: each capture requires a PR-body
// update, which reruns this job, which can fail the same bookkeeping check
// again. Real CI failures (format, lint, typecheck, test, build, CodeQL) and
// the other governance checks (AI quality, prevention, confidence, knowledge
// graph, recurrence, executive dashboard, root-cause decisions) still capture
// normally, since those evaluate evidence about the change itself.
const SELF_REFERENTIAL_GOVERNANCE_STEPS = new Set([
  'Verify pull-request governance structure',
  'Reconcile workflow failures and learning evidence',
  'Detect planning mistakes',
]);

export function isSelfReferentialGovernanceStep(stepName) {
  return SELF_REFERENTIAL_GOVERNANCE_STEPS.has(stepName);
}

async function resolvePullRequestNumber(workflowRun) {
  const directNumber = workflowRun.pull_requests?.[0]?.number;
  if (directNumber !== undefined) {
    return directNumber;
  }

  if (workflowRun.head_sha === undefined || workflowRun.head_sha === null) {
    return null;
  }

  try {
    const pullRequests = await githubRequest(`/commits/${workflowRun.head_sha}/pulls`);
    return pullRequests.find((pullRequest) => pullRequest.state === 'open')?.number ?? null;
  } catch {
    return null;
  }
}

export async function captureWorkflowRunFailure(workflowRun) {
  if (!FAILURE_CONCLUSIONS.has(workflowRun.conclusion)) {
    return { captured: 0, results: [] };
  }

  const jobs = await listAll(`/actions/runs/${workflowRun.id}/jobs`, {
    collectionKey: 'jobs',
  });
  const failedJobs = jobs.filter((job) => FAILURE_CONCLUSIONS.has(job.conclusion));
  if (failedJobs.length === 0) {
    throw new Error(`Workflow run ${workflowRun.id} failed but GitHub returned no failed job.`);
  }

  const prNumber = await resolvePullRequestNumber(workflowRun);
  const results = [];

  for (const job of failedJobs) {
    const failedSteps = job.steps?.filter((step) => FAILURE_CONCLUSIONS.has(step.conclusion)) ?? [];
    const capturableSteps = failedSteps.filter(
      (step) => !isSelfReferentialGovernanceStep(step.name),
    );

    if (failedSteps.length > 0 && capturableSteps.length === 0) {
      // Every failed step in this job is self-referential governance
      // bookkeeping; skip capture entirely rather than falling back to
      // "Unknown failed step" for it.
      continue;
    }

    const steps =
      capturableSteps.length === 0 ? [{ name: 'Unknown failed step' }] : capturableSteps;
    let logText = '';

    try {
      logText = await githubRequest(`/actions/jobs/${job.id}/logs`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
    } catch (error) {
      logText = `Job logs were unavailable: ${String(error)}`;
    }

    const classificationLog = limitWorkflowLog(logText);

    for (const step of steps) {
      const classifiedEvent = createEngineeringEvent({
        sourceType: 'ci-workflow',
        sourceId: `${workflowRun.id}:${job.id}:${step.number ?? step.name}`,
        occurredAt: workflowRun.updated_at ?? workflowRun.created_at,
        repository: process.env.GITHUB_REPOSITORY,
        prNumber,
        commitSha: workflowRun.head_sha,
        workflowRunId: workflowRun.id,
        workflowName: workflowRun.name,
        jobId: job.id,
        jobName: job.name,
        stepName: step.name,
        logText: classificationLog,
        evidenceUrls: [workflowRun.html_url, job.html_url].filter(Boolean),
      });
      const learningEvent = {
        ...classifiedEvent,
        symptom: createSafeWorkflowSymptom({
          workflowName: workflowRun.name,
          jobName: job.name,
          stepName: step.name,
          matchedSignatures: classifiedEvent.matchedSignatures,
        }),
      };

      results.push(await submitEngineeringEvent(learningEvent));
    }
  }

  return { captured: results.length, results };
}
