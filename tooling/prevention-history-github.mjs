import { githubRequest, listAll } from './engineering-learning-core.mjs';
import {
  buildPreventionControlOptions,
  parsePreventionIssueNumbers,
  parseResolvedMistakes,
} from './prevention-history-parser.mjs';

async function requestAll(path, request) {
  if (request === githubRequest) {
    return listAll(path);
  }
  const response = await request(path);
  if (Array.isArray(response)) {
    return response;
  }
  for (const key of ['items', 'commits', 'files', 'comments']) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }
  }
  return [];
}

async function collectCommits(number, request) {
  const summaries = await requestAll(`/pulls/${number}/commits`, request);
  const commits = [];
  for (let index = 0; index < summaries.length; index += 1) {
    const summary = summaries[index];
    const detail = await request(`/commits/${summary.sha}`);
    commits.push({
      sha: summary.sha,
      sequence: index,
      committedAt: detail.commit?.committer?.date ?? summary.commit?.committer?.date ?? null,
      files: (detail.files ?? []).map((file) => ({
        filename: file.filename,
        status: file.status,
      })),
    });
  }
  return commits;
}

export async function collectPreventionHistory({ pullRequest, request = githubRequest }) {
  if (!Number.isSafeInteger(Number(pullRequest?.number))) {
    throw new TypeError('collectPreventionHistory requires a pull request number.');
  }
  const number = Number(pullRequest.number);
  const commits = await collectCommits(number, request);
  const issueNumbers = parsePreventionIssueNumbers(pullRequest.body ?? '');
  const mistakes = [];
  for (const issueNumber of issueNumbers) {
    const [issue, comments] = await Promise.all([
      request(`/issues/${issueNumber}`),
      requestAll(`/issues/${issueNumber}/comments`, request),
    ]);
    mistakes.push(...parseResolvedMistakes(issue, comments));
  }
  return {
    phase: pullRequest.draft === true ? 'draft' : 'review',
    pullRequest: {
      number,
      draft: pullRequest.draft === true,
      headSha: pullRequest.head?.sha ?? pullRequest.head_sha ?? null,
      baseSha: pullRequest.base?.sha ?? pullRequest.base_sha ?? null,
    },
    preventionIssues: issueNumbers,
    changedFiles: [
      ...new Set(commits.flatMap((commit) => commit.files.map((file) => file.filename))),
    ],
    commits,
    mistakes,
    controlOptions: buildPreventionControlOptions(mistakes),
  };
}

export async function collectPreventionHistoryForPullRequest(number, request = githubRequest) {
  const pullRequest = await request(`/pulls/${Number(number)}`);
  return collectPreventionHistory({ pullRequest, request });
}
