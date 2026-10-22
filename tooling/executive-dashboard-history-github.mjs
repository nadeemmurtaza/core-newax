import {
  mergeExecutiveDashboardEvidence,
  parseExecutiveDashboardEvidence,
} from './executive-dashboard-history-parser.mjs';

async function collectPages(request, path, limit) {
  const values = [];
  for (let page = 1; page <= 20 && values.length < limit; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await request(`${path}${separator}per_page=100&page=${page}`);
    const items = Array.isArray(response) ? response : (response?.workflow_runs ?? []);
    if (items.length === 0) {
      break;
    }
    values.push(...items.slice(0, limit - values.length));
    if (items.length < 100) {
      break;
    }
  }
  return values;
}

function sourceUrl(value, fallback) {
  return value?.html_url ?? value?.url ?? fallback;
}

function reviewCoverageRecord(pull, reviews) {
  const submitted = reviews.filter(
    (review) => String(review.state ?? '').toLowerCase() !== 'pending',
  );
  const latest = submitted.at(-1);
  return {
    id: `review-pr-${pull.number}`,
    prNumber: Number(pull.number),
    at: latest?.submitted_at ?? pull.updated_at ?? pull.created_at,
    reviewed: submitted.length > 0,
    validFindings: null,
    resolvedBeforeMerge: null,
    escapedFindings: null,
    reviewer: latest?.user?.login ?? null,
    sourceRefs: [sourceUrl(pull, `pr:${pull.number}`)],
  };
}

const REPOSITORY_STEP =
  /(format|lint|type|test|build|verify|detect|reconcile|validate|migrat|analy|governance|prevention|confidence|knowledge|recurrence|dashboard)/i;

function workflowRecord(run, jobs) {
  const steps = jobs.flatMap((job) => (Array.isArray(job.steps) ? job.steps : []));
  const executed = steps.some((step) => REPOSITORY_STEP.test(String(step.name ?? '')));
  const conclusion = !executed ? 'blocked' : run.conclusion === 'success' ? 'pass' : 'fail';
  return {
    id: `workflow-${run.id}`,
    at: run.updated_at ?? run.created_at,
    executed,
    conclusion,
    prNumber: Number(run.pull_requests?.[0]?.number) || null,
    sourceRefs: [sourceUrl(run, `workflow:${run.id}`)],
  };
}

export async function collectExecutiveDashboardGithub({
  request,
  maxIssues = 300,
  maxPulls = 200,
  maxRuns = 200,
} = {}) {
  if (typeof request !== 'function') {
    throw new TypeError('A GitHub request function is required.');
  }
  const evidence = [];
  const issues = await collectPages(request, '/issues?state=all', maxIssues);
  for (const issue of issues) {
    const source = sourceUrl(issue, `issue:${issue.number}`);
    evidence.push(
      parseExecutiveDashboardEvidence(issue.body ?? '', {
        source,
        issueNumber: Number(issue.number),
        createdAt: issue.created_at,
      }),
    );
    const comments = await collectPages(request, `/issues/${issue.number}/comments`, 500);
    for (const comment of comments) {
      evidence.push(
        parseExecutiveDashboardEvidence(comment.body ?? '', {
          source: sourceUrl(comment, `${source}#comment-${comment.id}`),
          issueNumber: Number(issue.number),
          createdAt: comment.created_at,
        }),
      );
    }
  }

  const pulls = await collectPages(request, '/pulls?state=all', maxPulls);
  const reviewRecords = [];
  for (const pull of pulls) {
    const reviews = await collectPages(request, `/pulls/${pull.number}/reviews`, 500);
    reviewRecords.push(reviewCoverageRecord(pull, reviews));
    evidence.push(
      parseExecutiveDashboardEvidence(pull.body ?? '', {
        source: sourceUrl(pull, `pr:${pull.number}`),
        createdAt: pull.created_at,
      }),
    );
  }

  const runs = (await collectPages(request, '/actions/runs', maxRuns)).filter((run) =>
    /(continuous integration|governance|verification)/i.test(String(run.name ?? '')),
  );
  const governanceRecords = [];
  for (const run of runs) {
    const response = await request(`/actions/runs/${run.id}/jobs?per_page=100`);
    const jobs = Array.isArray(response) ? response : (response?.jobs ?? []);
    governanceRecords.push(workflowRecord(run, jobs));
  }

  return mergeExecutiveDashboardEvidence([...evidence, { reviewRecords }, { governanceRecords }]);
}
