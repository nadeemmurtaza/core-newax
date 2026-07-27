const RULES_VERSION = 1;

const GOVERNANCE_DOCUMENT_PATTERN =
  /^(?:docs\/(?:standards|policies|rules|decisions)\/|\.github\/rulesets\/)/i;
const TEMPLATE_PATH_PATTERN = /(?:^|\/)[^/]*template[^/]*(?:\/|$)/i;
const CHECKLIST_PATH_PATTERN = /(?:^|\/)[^/]*checklist[^/]*(?:\/|\.|$)/i;
const PROCESS_PATH_PATTERN =
  /^(?:\.github\/workflows\/|tooling\/(?:.*(?:governance|reconcil|workflow|learning|operation|audit|capture|normalize|submit|verify|validate|automation).*)|docs\/(?:standards|processes|operations)\/)/i;
const AUTOMATION_FILE_PATTERN =
  /^(?:\.github\/workflows\/|tooling\/.*(?:audit|capture|engine|flush|ingest|normalize|receive|reconcile|record|run|submit|validate|verify|automat).*)/i;
const MARKUP_PATH_PATTERN = /\.(?:md|mdx|ya?ml)$/i;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCollection(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeChange(change, index) {
  if (change === null || typeof change !== 'object' || Array.isArray(change)) {
    throw new TypeError(`changedFiles[${index}] must be an object.`);
  }
  const filename = normalizeString(change.filename);
  if (filename.length === 0) {
    throw new TypeError(`changedFiles[${index}].filename must be a non-empty string.`);
  }
  return {
    filename,
    previousFilename: normalizeString(change.previous_filename ?? change.previousFilename),
    status: normalizeString(change.status).toLowerCase() || 'modified',
    patch: typeof change.patch === 'string' ? change.patch : '',
  };
}

function changedLines(patch) {
  return String(patch ?? '')
    .split('\n')
    .filter(
      (line) =>
        (line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---')),
    )
    .map((line) => line.slice(1));
}

function addedLines(patch) {
  return String(patch ?? '')
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function addReason(reasons, code, message, files = []) {
  const normalizedFiles = [...new Set(files)].sort();
  const existing = reasons.find((reason) => reason.code === code);
  if (existing === undefined) {
    reasons.push({ code, message, files: normalizedFiles });
    return;
  }
  existing.files = [...new Set([...existing.files, ...normalizedFiles])].sort();
}

function createsRule(change) {
  if (change.status === 'added' && GOVERNANCE_DOCUMENT_PATTERN.test(change.filename)) {
    return true;
  }
  if (!/^(?:docs\/|\.github\/)/i.test(change.filename)) {
    return false;
  }
  return addedLines(change.patch).some((line) => {
    const text = line.trim();
    return (
      /^#{1,6}\s+.*\b(?:rule|policy|standard)\b/i.test(text) ||
      /^(?:[-*]\s+)?(?:must|must not|never|required|prohibited)\b/i.test(text)
    );
  });
}

function updatesChecklist(change) {
  if (CHECKLIST_PATH_PATTERN.test(change.filename)) {
    return true;
  }
  if (!MARKUP_PATH_PATTERN.test(change.filename)) {
    return false;
  }
  return changedLines(change.patch).some((line) => /^\s*[-*]\s+\[[ xX]\]\s+/.test(line));
}

function changesProcess(change) {
  if (PROCESS_PATH_PATTERN.test(change.filename)) {
    return true;
  }
  if (change.filename !== 'package.json') {
    return false;
  }
  return changedLines(change.patch).some((line) =>
    /"(?:learning:|verify|test:learning|operation:)/.test(line),
  );
}

function changesTemplate(change) {
  return (
    TEMPLATE_PATH_PATTERN.test(change.filename) ||
    TEMPLATE_PATH_PATTERN.test(change.previousFilename)
  );
}

function addsAutomation(change) {
  if (change.status === 'added' && AUTOMATION_FILE_PATTERN.test(change.filename)) {
    return true;
  }
  if (change.filename !== 'package.json') {
    return false;
  }
  return addedLines(change.patch).some((line) =>
    /"(?:learning:|verify|operation:)[^"]*"\s*:/.test(line),
  );
}

export function evaluateLearningRequirement({
  changedFiles = [],
  failedWorkflowRuns = [],
  linkedLearningIssues = [],
  localEvents = [],
  externalEvents = [],
} = {}) {
  const changes = normalizeCollection(changedFiles).map(normalizeChange);
  const reasons = [];

  const ruleFiles = changes.filter(createsRule).map((change) => change.filename);
  if (ruleFiles.length > 0) {
    addReason(
      reasons,
      'new-rule-created',
      'A new engineering rule, policy, or standard was created.',
      ruleFiles,
    );
  }

  const checklistFiles = changes.filter(updatesChecklist).map((change) => change.filename);
  if (checklistFiles.length > 0) {
    addReason(reasons, 'checklist-updated', 'A checklist was created or updated.', checklistFiles);
  }

  const processFiles = changes.filter(changesProcess).map((change) => change.filename);
  if (processFiles.length > 0) {
    addReason(
      reasons,
      'process-changed',
      'An engineering process or governance control changed.',
      processFiles,
    );
  }

  const templateFiles = changes.filter(changesTemplate).map((change) => change.filename);
  if (templateFiles.length > 0) {
    addReason(
      reasons,
      'template-changed',
      'A pull-request, issue, or operational template changed.',
      templateFiles,
    );
  }

  const automationFiles = changes.filter(addsAutomation).map((change) => change.filename);
  if (automationFiles.length > 0) {
    addReason(reasons, 'automation-added', 'Engineering automation was added.', automationFiles);
  }

  if (normalizeCollection(failedWorkflowRuns).length > 0) {
    addReason(
      reasons,
      'failed-workflow-run',
      'A failed pull-request workflow requires reconciliation.',
    );
  }
  if (normalizeCollection(linkedLearningIssues).length > 0) {
    addReason(
      reasons,
      'linked-learning-issue',
      'An occurrence-specific engineering-learning issue is linked.',
    );
  }
  if (normalizeCollection(localEvents).length > 0) {
    addReason(reasons, 'local-event-intake', 'A local engineering event was captured.');
  }
  if (normalizeCollection(externalEvents).length > 0) {
    addReason(reasons, 'external-event-intake', 'An external-tool engineering event was captured.');
  }

  const required = reasons.length > 0;
  return {
    rulesVersion: RULES_VERSION,
    learningOutcome: required ? 'required' : 'not-required',
    required,
    reasons,
  };
}

export function ledgerEntryChanged(ledgerEntry, changedFiles = []) {
  const entry = normalizeString(ledgerEntry);
  if (!/^EL-\d{4}$/.test(entry)) {
    return false;
  }
  return normalizeCollection(changedFiles).some((change, index) => {
    const normalized = normalizeChange(change, index);
    return (
      normalized.filename === 'docs/verification/engineering-learning-ledger.md' ||
      normalized.filename.includes(`docs/verification/engineering-learning-ledger/${entry}`)
    );
  });
}

export function validateLearningRecord({
  requirement,
  ledgerEntries = [],
  ledgerEntriesValue,
  learningIssueNumbers = [],
  learningIssuesValue,
  rootCauseStatus,
  rootCauseEvidence,
  resolutionEvidence,
  changedFiles = [],
  catalog = { rootCauses: [] },
} = {}) {
  if (
    requirement?.learningOutcome !== 'required' &&
    requirement?.learningOutcome !== 'not-required'
  ) {
    throw new TypeError('A machine-evaluated learning requirement is required.');
  }

  const errors = [];
  const classifications = [];
  if (requirement.learningOutcome === 'not-required') {
    if (ledgerEntriesValue !== 'not-required') {
      errors.push('A not-required outcome requires `not-required` ledger entries.');
    }
    if (learningIssuesValue !== 'not-required') {
      errors.push('A not-required outcome requires `not-required` learning issues.');
    }
    if (rootCauseStatus !== 'not-required') {
      errors.push('A not-required outcome requires `not-required` root-cause status.');
    }
    return { errors, classifications };
  }

  if (ledgerEntries.length === 0) {
    errors.push('A required learning outcome requires at least one ledger entry.');
  }
  if (learningIssueNumbers.length === 0) {
    errors.push(
      'A required learning outcome requires at least one linked engineering-learning issue.',
    );
  }
  if (!['confirmed', 'machine-supported'].includes(rootCauseStatus ?? '')) {
    errors.push(
      'A required learning outcome requires a confirmed or machine-supported root cause.',
    );
  }
  if (
    rootCauseEvidence === null ||
    rootCauseEvidence === 'pending' ||
    String(rootCauseEvidence).length < 8
  ) {
    errors.push('A required learning outcome requires concrete root-cause evidence.');
  }
  if (
    resolutionEvidence === null ||
    resolutionEvidence === 'pending' ||
    String(resolutionEvidence).length < 8
  ) {
    errors.push('A required learning outcome requires concrete resolution evidence.');
  }

  const knownEntries = new Set(
    (catalog?.rootCauses ?? []).map((rootCause) => rootCause.ledgerEntry),
  );
  for (const ledgerEntry of ledgerEntries) {
    if (ledgerEntryChanged(ledgerEntry, changedFiles)) {
      classifications.push({ ledgerEntry, classification: 'new' });
    } else if (knownEntries.has(ledgerEntry)) {
      classifications.push({ ledgerEntry, classification: 'existing' });
    } else {
      errors.push(
        `${ledgerEntry} is neither introduced by this pull request nor present in the learning catalog.`,
      );
    }
  }

  return { errors, classifications };
}
