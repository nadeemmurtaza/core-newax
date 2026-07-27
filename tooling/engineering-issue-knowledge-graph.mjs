import { githubRequest } from './engineering-learning-core.mjs';
import {
  renderKnowledgeGraphSection,
  replaceKnowledgeGraphSection,
} from './knowledge-graph-renderer.mjs';

export function knowledgeGraphRecordLink(issueNumber, url) {
  return `- Complete engineering history: [Knowledge graph #${issueNumber}](${url})`;
}

export function replaceKnowledgeGraphLink(body, issueNumber, url) {
  const line = knowledgeGraphRecordLink(issueNumber, url);
  const pattern = /^- Complete engineering history:.*$/im;
  const normalized = String(body ?? '').trimEnd();
  return pattern.test(normalized)
    ? normalized.replace(pattern, line)
    : `${normalized}\n\n${line}\n`;
}

export async function attachKnowledgeGraphToIssue(issueNumber, graph, options = {}) {
  const request = options.request ?? githubRequest;
  const issue = await request(`/issues/${issueNumber}`, options);
  const section = renderKnowledgeGraphSection(graph, {
    focusNodeId: options.focusNodeId ?? null,
  });
  const body = replaceKnowledgeGraphSection(issue.body ?? '', section);
  await request(`/issues/${issueNumber}`, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
  return { issueNumber, url: issue.html_url, digest: graph.digest };
}

export async function linkKnowledgeGraphRecord(
  targetNumber,
  recordIssueNumber,
  recordUrl,
  options = {},
) {
  const request = options.request ?? githubRequest;
  const target = await request(`/issues/${targetNumber}`, options);
  const body = replaceKnowledgeGraphLink(target.body ?? '', recordIssueNumber, recordUrl);
  await request(`/issues/${targetNumber}`, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
  return { targetNumber, recordIssueNumber, recordUrl };
}
