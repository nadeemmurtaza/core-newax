import { parseRecurrenceHistory } from './recurrence-history-parser.mjs';

async function defaultRequest(path, options = {}) {
  const token = options.token ?? process.env.GITHUB_TOKEN;
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY;
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for recurrence collection.');
  }
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required for recurrence collection.');
  }
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub recurrence request failed (${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
}

async function listAll(path, request, options) {
  const results = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const response = await request(`${path}${separator}per_page=100&page=${page}`, options);
    const values = Array.isArray(response) ? response : [];
    results.push(...values);
    if (values.length < 100) {
      break;
    }
  }
  return results;
}

export async function collectRecurrenceHistory(options = {}) {
  const request = options.request ?? defaultRequest;
  const issueNumbers = [...new Set(options.issueNumbers ?? [])].sort((left, right) => left - right);
  const histories = [];
  for (const issueNumber of issueNumbers) {
    const issue = await request(`/issues/${issueNumber}`, options);
    const comments = await listAll(`/issues/${issueNumber}/comments`, request, options);
    histories.push(parseRecurrenceHistory(issue, comments));
  }
  return {
    occurrences: histories.flatMap((history) => history.occurrences),
    rules: histories.flatMap((history) => history.rules),
    explanations: histories.flatMap((history) => history.explanations),
  };
}
