import { parseIssueNumbers, parsePullRequestField } from './engineering-learning-core.mjs';
import { validateExecutiveDashboardRecordPair } from './executive-dashboard-record.mjs';

const DASHBOARD_PATHS = [
  'tooling/executive-dashboard',
  'tooling/analyze-executive-dashboard.mjs',
  'tooling/verify-pr-executive-dashboard.mjs',
  '.github/ISSUE_TEMPLATE/engineering-executive-metric.yml',
  '.github/workflows/engineering-executive-dashboard.yml',
  'docs/standards/engineering-executive-dashboard.md',
  'docs/verification/engineering-learning-ledger/EL-0031-',
];

export function evaluateExecutiveDashboardGovernance({
  draft,
  body,
  changedFiles = [],
  recordPairs = [],
}) {
  const errors = [];
  const relevant = changedFiles.some((path) =>
    DASHBOARD_PATHS.some((prefix) => path.startsWith(prefix)),
  );
  const field = parsePullRequestField(body, '- Executive dashboard records:');
  const issueNumbers = field === null ? [] : parseIssueNumbers(field);
  const manuallySupplied = parsePullRequestField(body, '- Manual KPI values supplied:');
  if (manuallySupplied !== null && manuallySupplied.toLowerCase() !== 'no') {
    errors.push('Manual executive dashboard KPI values are prohibited.');
  }
  if (!draft && relevant && manuallySupplied === null) {
    errors.push('Review-ready executive dashboard changes require Manual KPI values supplied: no.');
  }
  if (!draft && relevant && issueNumbers.length === 0) {
    errors.push('Review-ready executive dashboard changes require a linked dashboard record.');
  }
  for (const pair of recordPairs) {
    errors.push(...validateExecutiveDashboardRecordPair(pair));
  }
  if (!draft && issueNumbers.length > recordPairs.length) {
    errors.push('Every linked executive dashboard issue requires a recalculable record pair.');
  }
  return { errors, issueNumbers, relevant };
}
