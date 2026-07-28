import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_DIRECTORY = resolve(CURRENT_DIRECTORY, '../.github/workflows');
const INTAKE_FILENAME = 'engineering-failure-intake.yml';
const EXEMPT_FILENAMES = new Set([INTAKE_FILENAME]);

export const MAX_CLASSIFICATION_LOG_CHARACTERS = 2_000_000;

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function limitWorkflowLog(value, maximum = MAX_CLASSIFICATION_LOG_CHARACTERS) {
  const text = String(value ?? '');
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new TypeError('maximum must be a positive safe integer.');
  }
  return text.length <= maximum ? text : text.slice(-maximum);
}

export function createSafeWorkflowSymptom({
  workflowName,
  jobName,
  stepName,
  matchedSignatures = [],
}) {
  const location = [workflowName, jobName, stepName]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' / ');
  const signatures = Array.from(
    new Set(matchedSignatures.map((value) => String(value).trim()).filter(Boolean)),
  );
  const evidence = signatures.length === 0 ? 'unclassified failure' : signatures.join(', ');

  return `${location || 'GitHub Actions workflow'} failed (${evidence}). Review the linked workflow logs; raw log content is not copied into this issue.`;
}

export function extractWorkflowName(content, filename = 'workflow') {
  const match = String(content).match(/^name:\s*(.+?)\s*$/m);
  if (match === null || unquote(match[1]).length === 0) {
    throw new Error(`${filename} does not declare a top-level workflow name.`);
  }
  return unquote(match[1]);
}

export function extractMonitoredWorkflowNames(content) {
  const lines = String(content).split('\n');
  const names = [];
  let inWorkflowList = false;

  for (const line of lines) {
    if (/^\s{4}workflows:\s*$/.test(line)) {
      inWorkflowList = true;
      continue;
    }
    if (!inWorkflowList) {
      continue;
    }

    const item = line.match(/^\s{6}-\s*(.+?)\s*$/);
    if (item !== null) {
      names.push(unquote(item[1]));
      continue;
    }
    if (line.trim().length > 0 && !/^\s{6,}/.test(line)) {
      break;
    }
  }

  return Array.from(new Set(names));
}

export function findWorkflowCoverageErrors({ workflowFiles, intakeContent }) {
  const monitored = new Set(extractMonitoredWorkflowNames(intakeContent));
  const errors = [];

  for (const workflow of workflowFiles) {
    if (EXEMPT_FILENAMES.has(workflow.filename)) {
      continue;
    }

    const name = extractWorkflowName(workflow.content, workflow.filename);
    if (!monitored.has(name)) {
      errors.push(
        `Workflow ${name} (${workflow.filename}) is not monitored by ${INTAKE_FILENAME}.`,
      );
    }
  }

  return errors;
}

export function verifyWorkflowIntakeCoverage(directory = WORKFLOW_DIRECTORY) {
  const filenames = readdirSync(directory)
    .filter((filename) => /\.ya?ml$/.test(filename))
    .sort();
  const workflowFiles = filenames.map((filename) => ({
    filename,
    content: readFileSync(resolve(directory, filename), 'utf8'),
  }));
  const intake = workflowFiles.find((workflow) => workflow.filename === INTAKE_FILENAME);

  if (intake === undefined) {
    throw new Error(`${INTAKE_FILENAME} is missing from ${directory}.`);
  }

  return findWorkflowCoverageErrors({
    workflowFiles,
    intakeContent: intake.content,
  });
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = verifyWorkflowIntakeCoverage();
  if (errors.length > 0) {
    console.error('Workflow failure-intake coverage validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Every GitHub Actions workflow except the intake workflow itself is covered.');
}
