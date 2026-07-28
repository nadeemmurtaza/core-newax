import { readFileSync } from 'node:fs';

import { githubRequest } from './engineering-learning-core.mjs';
import { captureWorkflowRunFailure } from './workflow-failure-capture.mjs';

async function readWorkflowRun() {
  const runId = process.env.ENGINEERING_WORKFLOW_RUN_ID;
  if (runId !== undefined && runId.length > 0) {
    return githubRequest(`/actions/runs/${runId}`);
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined || eventPath.length === 0) {
    throw new Error('GITHUB_EVENT_PATH or ENGINEERING_WORKFLOW_RUN_ID is required.');
  }

  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  if (event.workflow_run === undefined) {
    throw new Error('The workflow_run payload is unavailable.');
  }
  return event.workflow_run;
}

const workflowRun = await readWorkflowRun();
const result = await captureWorkflowRunFailure(workflowRun);
console.log(JSON.stringify(result));
