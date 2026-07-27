import { githubRequest, listAll } from './engineering-learning-core.mjs';
import {
  parseCommunicationEvents,
  parseCommunicationIssueNumbers,
} from './communication-history-parser.mjs';

async function requestAll(path, request) {
  if (request === githubRequest) {
    return listAll(path);
  }
  const response = await request(path);
  if (Array.isArray(response)) {
    return response;
  }
  for (const key of ['items', 'commits', 'comments', 'reviews']) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }
  }
  return [];
}

function sourceEvents(items, kind) {
  return items.flatMap((item) =>
    parseCommunicationEvents(item.body ?? '', {
      source: `${kind}:${item.id ?? item.number ?? 'unknown'}`,
      createdAt: item.submitted_at ?? item.created_at ?? item.createdAt ?? null,
    }),
  );
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
      message: detail.commit?.message ?? summary.commit?.message ?? '',
      authoredAt: detail.commit?.author?.date ?? summary.commit?.author?.date ?? null,
      committedAt: detail.commit?.committer?.date ?? summary.commit?.committer?.date ?? null,
      files: (detail.files ?? []).map((file) => ({ filename: file.filename, status: file.status })),
    });
  }
  return commits;
}

export async function collectCommunicationHistory({ pullRequest, request = githubRequest }) {
  if (!Number.isSafeInteger(Number(pullRequest?.number))) {
    throw new TypeError('collectCommunicationHistory requires a pull request number.');
  }
  const number = Number(pullRequest.number);
  const [commits, prComments, reviewComments, reviews] = await Promise.all([
    collectCommits(number, request),
    requestAll(`/issues/${number}/comments`, request),
    requestAll(`/pulls/${number}/comments`, request),
    requestAll(`/pulls/${number}/reviews`, request),
  ]);
  const events = [
    ...parseCommunicationEvents(pullRequest.body ?? '', {
      source: `pull-request:${number}`,
      createdAt: pullRequest.created_at ?? null,
    }),
    ...sourceEvents(prComments, 'pr-comment'),
    ...sourceEvents(reviewComments, 'review-comment'),
    ...sourceEvents(reviews, 'review'),
  ];

  const communicationIssues = parseCommunicationIssueNumbers(pullRequest.body ?? '');
  for (const issueNumber of communicationIssues) {
    const [issue, comments] = await Promise.all([
      request(`/issues/${issueNumber}`),
      requestAll(`/issues/${issueNumber}/comments`, request),
    ]);
    events.push(
      ...parseCommunicationEvents(issue.body ?? '', {
        source: `issue:${issueNumber}`,
        createdAt: issue.created_at ?? issue.createdAt ?? null,
      }),
      ...sourceEvents(comments, `issue-${issueNumber}-comment`),
    );
  }

  return {
    phase: pullRequest.draft === true ? 'draft' : 'review',
    pullRequest: {
      number,
      draft: pullRequest.draft === true,
      headSha: pullRequest.head?.sha ?? pullRequest.head_sha ?? null,
      baseSha: pullRequest.base?.sha ?? pullRequest.base_sha ?? null,
    },
    communicationIssues,
    commits,
    events,
  };
}

export async function collectCommunicationHistoryForPullRequest(number, request = githubRequest) {
  const pullRequest = await request(`/pulls/${Number(number)}`);
  return collectCommunicationHistory({ pullRequest, request });
}
