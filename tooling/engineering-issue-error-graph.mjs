import { githubRequest, listAll } from './engineering-learning-core.mjs';
import { ensureExplanationSection, renderExplanationSection } from './explanation-verification.mjs';
import {
  createErrorGraphContext,
  parseErrorGraphMetadata,
} from './engineering-issue-error-graph-data.mjs';
import { sanitizeEngineeringEvidence } from './sanitize-engineering-evidence.mjs';

const GRAPH_MARKER = 'newax-error-relationship-graph';

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function nodeLabel(graph, nodeId) {
  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  return node?.label ?? nodeId;
}

function renderList(values, emptyMessage) {
  return values.length === 0
    ? `- ${emptyMessage}`
    : values.map((value) => `- \`${sanitizeEngineeringEvidence(value)}\``).join('\n');
}

export { createErrorGraphContext, parseErrorGraphMetadata };

export function renderErrorGraphSection(event, context) {
  const commonAncestor = context.primaryCommonAncestorId;
  const relatedIssues = context.relatedIssueNumbers;
  const nearestAncestors = context.lowestCommonAncestorIds;
  const chainText =
    context.chains.length === 0
      ? '- No verified causal chain is available.'
      : context.chains
          .map((chain) => chain.map((nodeId) => nodeLabel(context.graph, nodeId)).join(' → '))
          .map((chain) => `- ${sanitizeEngineeringEvidence(chain)}`)
          .join('\n');

  return `<!-- ${GRAPH_MARKER}
graph-node-id: ${context.currentNodeId}
graph-root-ancestor-ids: ${context.rootAncestorIds.join('|') || 'none'}
graph-common-ancestor-id: ${commonAncestor ?? 'none'}
graph-related-issues: ${relatedIssues.map((issueNumber) => `#${issueNumber}`).join(',') || 'none'}
graph-links: ${encodeJson(event.relationshipHints ?? [])}
graph-impacts: ${encodeJson(event.impacts ?? [])}
-->
## Error relationship graph

- Current occurrence: \`${context.currentNodeId}\`
- Primary verified common root: ${commonAncestor === null ? 'None found' : `\`${commonAncestor}\``}
- Nearest verified common ancestor: ${nearestAncestors.length === 0 ? 'None found' : nearestAncestors.map((nodeId) => `\`${nodeId}\``).join(', ')}
- Related occurrences: ${relatedIssues.length === 0 ? 'None found' : relatedIssues.map((number) => `#${number}`).join(', ')}
- Candidate relationships are excluded from verified ancestor decisions.

### Direct verified parents

${renderList(context.directParentIds, 'No direct verified parent was identified.')}

### Verified root ancestors

${renderList(context.rootAncestorIds, 'No verified root ancestor was identified.')}

### Downstream failures and impacts

${renderList(context.downstreamNodeIds, 'No downstream impact was recorded.')}

### Verified causal chains

${chainText}
<!-- /${GRAPH_MARKER} -->`;
}

export function replaceErrorGraphSection(body, section) {
  const pattern = new RegExp(`<!-- ${GRAPH_MARKER}\\n[\\s\\S]*?<!-- \\/${GRAPH_MARKER} -->`);
  const normalizedBody = String(body ?? '').trimEnd();
  return pattern.test(normalizedBody)
    ? normalizedBody.replace(pattern, section)
    : `${normalizedBody}\n\n${section}\n`;
}

export async function attachErrorRelationshipGraph(issueNumber, event, options = {}) {
  const issues = await listAll('/issues?state=all', options);
  const issue = issues.find((candidate) => candidate.number === issueNumber);
  if (issue === undefined) {
    throw new Error(`Engineering learning issue #${issueNumber} could not be loaded.`);
  }
  const context = createErrorGraphContext(
    event,
    issues.filter((candidate) => candidate.pull_request === undefined),
  );
  const graphSection = renderErrorGraphSection(event, context);
  const explanationSection = renderExplanationSection(event);
  const withGraph = replaceErrorGraphSection(issue.body, graphSection);
  const body = ensureExplanationSection(withGraph, explanationSection);
  await githubRequest(`/issues/${issueNumber}`, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify({ body }),
  });
  return {
    issueNumber,
    graphNodeId: context.currentNodeId,
    lowestCommonAncestorIds: context.lowestCommonAncestorIds,
    rootAncestorIds: context.rootAncestorIds,
    primaryCommonAncestorId: context.primaryCommonAncestorId,
    relatedIssueNumbers: context.relatedIssueNumbers,
    explanationDecision: 'challenged',
  };
}
