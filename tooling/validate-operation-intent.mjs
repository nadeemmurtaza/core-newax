import { readFileSync } from 'node:fs';

const ACTIONS_BY_TARGET = {
  'branch-reference': new Set(['create_branch', 'update_ref']),
  'issue-metadata': new Set(['create_issue', 'update_issue', 'add_issue_labels']),
  'pull-request-metadata': new Set(['create_pull_request', 'update_pull_request']),
  'pull-request-review-state': new Set([
    'add_review_to_pr',
    'convert_pull_request_to_draft',
    'mark_pull_request_ready_for_review',
    'request_pull_request_reviewers',
  ]),
  'repository-content': new Set(['create_file', 'delete_file', 'update_file']),
};

export function validateOperationIntent(intent) {
  const errors = [];
  const allowedActions = ACTIONS_BY_TARGET[intent.targetType];

  if (allowedActions === undefined) {
    errors.push(`Unsupported target type: ${intent.targetType ?? 'missing'}.`);
  } else if (!allowedActions.has(intent.action)) {
    errors.push(
      `Action ${intent.action ?? 'missing'} does not match target type ${intent.targetType}.`,
    );
  }

  for (const field of ['targetIdentifier', 'expectedPostcondition', 'prohibitedSideEffects']) {
    if (typeof intent[field] !== 'string' || intent[field].trim().length === 0) {
      errors.push(`Operation intent requires ${field}.`);
    }
  }

  return errors;
}

function readIntent() {
  const inline = process.env.ENGINEERING_OPERATION_INTENT;
  if (inline !== undefined && inline.length > 0) {
    return JSON.parse(inline);
  }

  const path = process.argv[2];
  if (path === undefined) {
    throw new Error(
      'Provide ENGINEERING_OPERATION_INTENT JSON or a path to an operation-intent JSON file.',
    );
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intent = readIntent();
  const errors = validateOperationIntent(intent);
  if (errors.length > 0) {
    console.error('Operation intent validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }
  console.log('Operation intent matches the selected target and action.');
}
