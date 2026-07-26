const FAILURE_CONCLUSIONS = new Set(['action_required', 'failure', 'timed_out']);
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function asSafeInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function failure(record, reason) {
  return {
    ...record,
    status: 'unavailable',
    provenanceVerified: false,
    provenanceError: reason,
  };
}

function success(record) {
  return {
    ...record,
    status: 'verified',
    provenanceVerified: true,
    provenanceError: null,
  };
}

function findStep(job, stepName, conclusions) {
  if (!Array.isArray(job.steps) || job.steps.length === 0) {
    return { error: `Step metadata is unavailable for job ${job.id}.`, step: null };
  }
  const step = job.steps.find((candidate) => candidate.name === stepName);
  if (step === undefined || !conclusions.has(step.conclusion)) {
    return {
      error: `Step ${stepName} does not have the required conclusion in job ${job.id}.`,
      step: null,
    };
  }
  return { error: null, step };
}

async function verifyLog(record, githubRequest, listAll) {
  const workflowRunId = asSafeInteger(record.workflowRunId);
  const jobId = asSafeInteger(record.jobId);
  const stepName = String(record.stepName ?? '').trim();
  if (workflowRunId === null || jobId === null || stepName.length === 0) {
    return failure(
      record,
      'Log evidence requires safe workflow-run and job identifiers plus an exact failed step name.',
    );
  }
  const run = await githubRequest(`/actions/runs/${workflowRunId}`);
  if (!FAILURE_CONCLUSIONS.has(run?.conclusion)) {
    return failure(record, `Workflow run ${workflowRunId} is not a failed run.`);
  }
  const jobs = await listAll(`/actions/runs/${workflowRunId}/jobs`, {
    collectionKey: 'jobs',
  });
  const job = jobs.find((candidate) => candidate.id === jobId);
  if (job === undefined || !FAILURE_CONCLUSIONS.has(job.conclusion)) {
    return failure(record, `Job ${jobId} is not a failed job in workflow run ${workflowRunId}.`);
  }
  const stepResult = findStep(job, stepName, FAILURE_CONCLUSIONS);
  if (stepResult.error !== null) {
    return failure(record, stepResult.error);
  }
  return success({
    ...record,
    workflowName: run.name ?? record.workflowName,
    commitSha: run.head_sha ?? record.commitSha,
    jobName: job.name ?? record.jobName,
  });
}

async function verifyCommit(record, githubRequest) {
  const commitSha = String(record.commitSha ?? '').trim();
  if (!SHA_PATTERN.test(commitSha)) {
    return failure(record, 'Commit evidence requires a full 40-character SHA.');
  }
  const commit = await githubRequest(`/commits/${commitSha}`);
  if (commit?.sha !== commitSha) {
    return failure(record, `Commit ${commitSha} could not be verified exactly.`);
  }
  return success(record);
}

async function verifyTest(record, githubRequest, listAll) {
  const workflowRunId = asSafeInteger(record.workflowRunId);
  const jobId = asSafeInteger(record.jobId);
  const stepName = String(record.stepName ?? '').trim();
  const testName = String(record.testName ?? '').trim();
  const command = String(record.command ?? '').trim();
  if (
    workflowRunId === null ||
    jobId === null ||
    stepName.length === 0 ||
    testName.length === 0 ||
    command.length === 0
  ) {
    return failure(
      record,
      'Test evidence requires a successful workflow run, job, exact successful step, test name, and command.',
    );
  }
  const run = await githubRequest(`/actions/runs/${workflowRunId}`);
  if (run?.conclusion !== 'success') {
    return failure(record, `Workflow run ${workflowRunId} did not complete successfully.`);
  }
  const jobs = await listAll(`/actions/runs/${workflowRunId}/jobs`, {
    collectionKey: 'jobs',
  });
  const job = jobs.find((candidate) => candidate.id === jobId);
  if (job === undefined || job.conclusion !== 'success') {
    return failure(
      record,
      `Job ${jobId} is not a successful job in workflow run ${workflowRunId}.`,
    );
  }
  const stepResult = findStep(job, stepName, new Set(['success']));
  if (stepResult.error !== null) {
    return failure(record, stepResult.error);
  }
  if (record.reproduces !== true || record.outcome !== 'passed') {
    return failure(
      record,
      'Test evidence must state that the passing test reproduces the failure condition.',
    );
  }
  return success({
    ...record,
    commitSha: run.head_sha ?? record.commitSha,
    jobName: job.name ?? record.jobName,
  });
}

export async function verifyGithubExplanationEvidence({ evidence = [], githubRequest, listAll }) {
  if (typeof githubRequest !== 'function' || typeof listAll !== 'function') {
    throw new TypeError(
      'GitHub evidence verification requires githubRequest and listAll functions.',
    );
  }

  const verifiedEvidence = [];
  const errors = [];
  for (const record of evidence) {
    let verified;
    try {
      if (record?.type === 'log') {
        verified = await verifyLog(record, githubRequest, listAll);
      } else if (record?.type === 'commit') {
        verified = await verifyCommit(record, githubRequest);
      } else if (record?.type === 'test') {
        verified = await verifyTest(record, githubRequest, listAll);
      } else {
        verified = failure(
          record,
          `Evidence type ${String(record?.type ?? 'unknown')} has no automatic GitHub provenance verifier.`,
        );
      }
    } catch (error) {
      verified = failure(record, `GitHub evidence lookup failed: ${String(error)}`);
    }
    verifiedEvidence.push(verified);
    if (verified.provenanceVerified !== true) {
      errors.push(`${verified.id ?? 'unknown evidence'}: ${verified.provenanceError}`);
    }
  }

  return { evidence: verifiedEvidence, errors };
}
