import { detectPlanningMistakes, pathMatchesScope } from './planning-mistake-detector.mjs';

const ARCHITECTURE_PATH_PATTERN =
  /(?:^|\/)(?:adr|adrs|architecture|decisions?)(?:\/|$)|(?:^|\/)ADR[-_ ]?\d+/i;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validTimestamp(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  return !Number.isNaN(Date.parse(value));
}

function eventType(event) {
  return String(event?.type ?? event?.event ?? '')
    .trim()
    .toLowerCase();
}

function eventTaskId(event) {
  return String(event?.taskId ?? event?.['task-id'] ?? '').trim();
}

function eventPath(event) {
  return String(event?.path ?? event?.scope ?? '').trim();
}

function eventTimestamp(event) {
  return event?.at ?? event?.createdAt ?? event?.created_at ?? null;
}

function eventStatus(event) {
  return String(event?.status ?? '')
    .trim()
    .toLowerCase();
}

function commitTimestamp(commit) {
  return commit?.committedAt ?? commit?.authoredAt ?? commit?.timestamp ?? commit?.date ?? null;
}

function commitFiles(commit) {
  return asArray(commit?.files)
    .map((file) => (typeof file === 'string' ? file : (file?.filename ?? file?.path)))
    .filter((filename) => typeof filename === 'string' && filename.length > 0);
}

function addNotice(notices, notice) {
  const key = `${notice.code}:${notice.taskId ?? ''}:${notice.filename ?? ''}`;
  if (
    notices.some(
      (candidate) =>
        `${candidate.code}:${candidate.taskId ?? ''}:${candidate.filename ?? ''}` === key,
    )
  ) {
    return;
  }
  notices.push({ type: 'insufficient-evidence', ...notice });
}

function recompute(result) {
  const blockers = result.findings.filter(
    (finding) =>
      finding.state === 'detected' && finding.confidence === 'high' && finding.waived !== true,
  );
  const suspected = result.findings.filter(
    (finding) => finding.state === 'suspected' && finding.waived !== true,
  );
  result.blockers = blockers.map((finding) => finding.id);
  result.summary = {
    blockers: blockers.length,
    detected: result.findings.filter((finding) => finding.state === 'detected').length,
    suspected: result.findings.filter((finding) => finding.state === 'suspected').length,
    waived: result.findings.filter((finding) => finding.waived === true).length,
    notices: result.notices.length,
  };
  result.status =
    blockers.length > 0
      ? 'detected'
      : suspected.length > 0
        ? 'review-required'
        : result.notices.length > 0
          ? 'insufficient-evidence'
          : 'clear';
  return result;
}

/**
 * Public planning analysis boundary.
 *
 * The rule evaluator identifies candidate violations. This layer prevents a
 * missing timestamp from being promoted into a historical ordering claim.
 */
export function analyzePlanningMistakes(input = {}) {
  const result = structuredClone(detectPlanningMistakes(input));
  const events = asArray(input.events);
  const commits = asArray(input.commits);
  const declaredScopePaths = asArray(input.declaredScopePaths ?? input.scopePaths);
  const removedFindingIds = new Set();

  for (const finding of result.findings) {
    if (finding.type === 'wrong-implementation-order') {
      const dependent = finding.evidence.find((item) => item.kind === 'dependent-start');
      const prerequisite = finding.evidence.find((item) => item.kind === 'prerequisite-completion');
      if (!validTimestamp(dependent?.at) || !validTimestamp(prerequisite?.at)) {
        removedFindingIds.add(finding.id);
        addNotice(result.notices, {
          code: 'sequence-timestamp-missing',
          taskId: finding.taskIds[0] ?? null,
          message:
            'Task ordering cannot be proven because the dependent start or prerequisite completion timestamp is unavailable.',
        });
      }
    }

    if (finding.type === 'skipped-architecture-review') {
      const taskId = finding.taskIds[0] ?? '';
      const reviewEvent = events.find(
        (event) =>
          eventType(event) === 'architecture-reviewed' &&
          ['approved', 'accepted'].includes(eventStatus(event)) &&
          (eventTaskId(event) === '' || eventTaskId(event) === taskId),
      );
      const architectureCommit = commits.find((commit) =>
        commitFiles(commit).some((filename) => ARCHITECTURE_PATH_PATTERN.test(filename)),
      );
      const evidenceExists = reviewEvent !== undefined || architectureCommit !== undefined;
      const timestampExists =
        validTimestamp(eventTimestamp(reviewEvent)) ||
        validTimestamp(commitTimestamp(architectureCommit));
      if (evidenceExists && !timestampExists) {
        removedFindingIds.add(finding.id);
        addNotice(result.notices, {
          code: 'architecture-review-timestamp-missing',
          taskId,
          message:
            'Architecture approval evidence exists, but its timestamp is unavailable, so review order cannot be proven.',
        });
      }
    }
  }

  if (declaredScopePaths.length > 0) {
    const firstCommitByFile = new Map();
    for (const commit of commits) {
      for (const filename of commitFiles(commit)) {
        if (!firstCommitByFile.has(filename)) firstCommitByFile.set(filename, commit);
      }
    }
    for (const [filename, firstCommit] of firstCommitByFile) {
      if (pathMatchesScope(filename, declaredScopePaths)) continue;
      const approval = events.find(
        (event) =>
          eventType(event) === 'scope-approved' &&
          eventPath(event).length > 0 &&
          pathMatchesScope(filename, [eventPath(event)]),
      );
      if (
        approval !== undefined &&
        (!validTimestamp(eventTimestamp(approval)) || !validTimestamp(commitTimestamp(firstCommit)))
      ) {
        for (const finding of result.findings) {
          if (
            finding.type === 'scope-creep' &&
            finding.evidence.some(
              (item) => item.kind === 'out-of-scope-file' && item.filename === filename,
            )
          ) {
            removedFindingIds.add(finding.id);
          }
        }
        addNotice(result.notices, {
          code: 'scope-approval-timestamp-missing',
          filename,
          message:
            'Scope approval exists, but approval order cannot be proven because an approval or first-change timestamp is unavailable.',
        });
      }
    }
  }

  result.findings = result.findings.filter((finding) => !removedFindingIds.has(finding.id));
  return recompute(result);
}
