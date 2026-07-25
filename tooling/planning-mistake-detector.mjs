import { createHash } from 'node:crypto';

export const PLANNING_MISTAKE_TYPES = Object.freeze([
  'forgot-migration',
  'forgot-dependency',
  'wrong-implementation-order',
  'ignored-requirement',
  'skipped-architecture-review',
  'wrong-estimate',
  'scope-creep',
]);

const MIGRATION_PATH_PATTERN =
  /(?:^|\/)(?:migrations?|database\/migrations?)(?:\/|$)|migration\.sql$/i;
const SCHEMA_PATH_PATTERN =
  /(?:^|\/)(?:schema\.prisma|schema\.(?:sql|ts|json)|models?\.(?:ts|js))$/i;
const MANIFEST_PATH_PATTERN =
  /(?:^|\/)(?:package\.json|pyproject\.toml|requirements(?:-[^/]*)?\.txt|go\.mod|Cargo\.toml|Gemfile|composer\.json)$/i;
const LOCKFILE_PATH_PATTERN =
  /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock|uv\.lock|poetry\.lock|go\.sum|Cargo\.lock|Gemfile\.lock|composer\.lock)$/i;
const ARCHITECTURE_PATH_PATTERN =
  /(?:^|\/)(?:adr|adrs|architecture|decisions?)(?:\/|$)|(?:^|\/)ADR[-_ ]?\d+/i;
const SOURCE_PATH_PATTERN = /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|cs|php|rb|sql|prisma)$/i;
const CORRECTIVE_MIGRATION_MESSAGE =
  /\b(?:forgot|missing|omitted|add(?:ed)?|fix(?:ed)?)\b.{0,40}\bmigration\b|\bmigration\b.{0,40}\b(?:forgot|missing|omitted|fix(?:ed)?)\b/i;
const CORRECTIVE_DEPENDENCY_MESSAGE =
  /\b(?:forgot|missing|omitted|add(?:ed)?|fix(?:ed)?)\b.{0,40}\b(?:dependency|dependencies|lockfile|manifest)\b|\b(?:dependency|dependencies|lockfile|manifest)\b.{0,40}\b(?:forgot|missing|omitted|fix(?:ed)?)\b/i;

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeString(value).toLowerCase();
  if (['yes', 'true', 'required'].includes(normalized)) return true;
  if (['no', 'false', 'not-required', 'none'].includes(normalized)) return false;
  return null;
}

function normalizeDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '') return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFile(file, index) {
  if (file === null || typeof file !== 'object' || Array.isArray(file)) {
    throw new TypeError(`files[${index}] must be an object.`);
  }
  const filename = normalizeString(file.filename ?? file.path);
  if (filename.length === 0) throw new TypeError(`files[${index}] requires filename.`);
  return {
    filename,
    status: normalizeString(file.status).toLowerCase() || 'modified',
    patch: typeof file.patch === 'string' ? file.patch : '',
  };
}

function normalizeCommit(commit, index) {
  if (commit === null || typeof commit !== 'object' || Array.isArray(commit)) {
    throw new TypeError(`commits[${index}] must be an object.`);
  }
  const sha = normalizeString(commit.sha) || `commit-${index + 1}`;
  const timestamp = normalizeDate(
    commit.committedAt ?? commit.authoredAt ?? commit.timestamp ?? commit.date,
  );
  return {
    sha,
    message: normalizeString(commit.message),
    timestamp,
    sequence: Number.isFinite(commit.sequence) ? Number(commit.sequence) : index,
    files: normalizeArray(commit.files).map(normalizeFile),
  };
}

function normalizeTask(task, index) {
  if (task === null || typeof task !== 'object' || Array.isArray(task)) {
    throw new TypeError(`tasks[${index}] must be an object.`);
  }
  const id = normalizeString(task.id ?? task.taskId);
  if (id.length === 0) throw new TypeError(`tasks[${index}] requires id.`);
  const estimate = Number(task.estimateMinutes ?? task.estimate);
  return {
    id,
    title: normalizeString(task.title),
    order: Number.isFinite(Number(task.order)) ? Number(task.order) : index + 1,
    dependsOn: normalizeArray(task.dependsOn ?? task.depends),
    estimateMinutes: Number.isFinite(estimate) && estimate > 0 ? estimate : null,
    startedAt: normalizeDate(task.startedAt),
    completedAt: normalizeDate(task.completedAt),
    scopePaths: normalizeArray(task.scopePaths ?? task.scope),
    migrationRequired: normalizeBoolean(task.migrationRequired ?? task.migration),
    dependencyRequired: normalizeBoolean(task.dependencyRequired ?? task.dependency),
    architectureReviewRequired: normalizeBoolean(
      task.architectureReviewRequired ?? task.architectureReview,
    ),
    requirementIds: normalizeArray(task.requirementIds ?? task.requirements),
    issueNumber: Number.isSafeInteger(Number(task.issueNumber)) ? Number(task.issueNumber) : null,
  };
}

function normalizeRequirement(requirement, index) {
  if (requirement === null || typeof requirement !== 'object' || Array.isArray(requirement)) {
    throw new TypeError(`requirements[${index}] must be an object.`);
  }
  const id = normalizeString(requirement.id ?? requirement.requirementId);
  if (id.length === 0) throw new TypeError(`requirements[${index}] requires id.`);
  return {
    id,
    text: normalizeString(requirement.text ?? requirement.title),
    requiredPaths: normalizeArray(requirement.requiredPaths ?? requirement.paths),
    satisfied: normalizeBoolean(requirement.satisfied ?? requirement.complete),
    satisfiedAt: normalizeDate(requirement.satisfiedAt),
    issueNumber: Number.isSafeInteger(Number(requirement.issueNumber))
      ? Number(requirement.issueNumber)
      : null,
  };
}

function normalizeEvent(event, index) {
  if (event === null || typeof event !== 'object' || Array.isArray(event)) {
    throw new TypeError(`events[${index}] must be an object.`);
  }
  return {
    type: normalizeString(event.type ?? event.event).toLowerCase(),
    taskId: normalizeString(event.taskId ?? event['task-id']),
    requirementId: normalizeString(event.requirementId ?? event['requirement-id']),
    findingType: normalizeString(event.findingType ?? event['finding-type']).toLowerCase(),
    at: normalizeDate(event.at ?? event.createdAt ?? event.created_at),
    status: normalizeString(event.status).toLowerCase(),
    path: normalizeString(event.path ?? event.scope),
    estimateMinutes: Number.isFinite(Number(event.estimateMinutes ?? event.estimate))
      ? Number(event.estimateMinutes ?? event.estimate)
      : null,
    reviewer: normalizeString(event.reviewer ?? event.approvedBy ?? event['approved-by']),
    reason: normalizeString(event.reason),
  };
}

function patternToRegExp(pattern) {
  const normalized = normalizeString(pattern).replace(/^\.\//, '');
  const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const wildcard = escaped.replaceAll('**', '__DOUBLE_STAR__').replaceAll('*', '[^/]*');
  return new RegExp(`^${wildcard.replaceAll('__DOUBLE_STAR__', '.*')}(?:/.*)?$`);
}

export function pathMatchesScope(filename, patterns = []) {
  return normalizeArray(patterns).some((pattern) => patternToRegExp(pattern).test(filename));
}

function commitsChronologically(commits) {
  return [...commits].sort((left, right) => {
    if (left.timestamp !== null && right.timestamp !== null) {
      const difference = Date.parse(left.timestamp) - Date.parse(right.timestamp);
      if (difference !== 0) return difference;
    } else if (left.timestamp !== null) {
      return -1;
    } else if (right.timestamp !== null) {
      return 1;
    }
    return left.sequence - right.sequence;
  });
}

function firstCommitMatching(commits, predicate) {
  return commits.find((commit) => commit.files.some((file) => predicate(file, commit))) ?? null;
}

function commitsForTask(task, commits) {
  if (task.scopePaths.length === 0) return [];
  return commits.filter((commit) =>
    commit.files.some((file) => pathMatchesScope(file.filename, task.scopePaths)),
  );
}

function latestEvent(events, predicate, before = null) {
  return (
    events
      .filter(predicate)
      .filter(
        (event) =>
          before === null || event.at === null || Date.parse(event.at) <= Date.parse(before),
      )
      .sort((left, right) => Date.parse(left.at ?? 0) - Date.parse(right.at ?? 0))
      .at(-1) ?? null
  );
}

function earliestDate(values) {
  const valid = values.filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b));
  return valid[0] ?? null;
}

function latestDate(values) {
  const valid = values.filter(Boolean).sort((a, b) => Date.parse(a) - Date.parse(b));
  return valid.at(-1) ?? null;
}

function taskTiming(task, events, taskCommits) {
  const startedEvents = events.filter(
    (event) => event.taskId === task.id && event.type === 'task-started',
  );
  const completedEvents = events.filter(
    (event) => event.taskId === task.id && event.type === 'task-completed',
  );
  const firstCommitAt = taskCommits.find((commit) => commit.timestamp !== null)?.timestamp ?? null;
  const lastCommitAt =
    [...taskCommits].reverse().find((commit) => commit.timestamp !== null)?.timestamp ?? null;
  return {
    firstCommitAt,
    lastCommitAt,
    startedAt: earliestDate([
      task.startedAt,
      ...startedEvents.map((event) => event.at),
      firstCommitAt,
    ]),
    completedAt: latestDate([task.completedAt, ...completedEvents.map((event) => event.at)]),
  };
}

function stableFindingId(type, taskIds, evidence) {
  const source = JSON.stringify({ type, taskIds: [...taskIds].sort(), evidence });
  return `PM-${type.toUpperCase()}-${createHash('sha256').update(source).digest('hex').slice(0, 10)}`;
}

function createFinding({
  type,
  state = 'detected',
  confidence = 'high',
  severity = 'medium',
  title,
  taskIds = [],
  requirementIds = [],
  evidence = [],
  missingEvidence = [],
  recommendation,
}) {
  return {
    id: stableFindingId(type, taskIds, evidence),
    type,
    state,
    confidence,
    severity,
    title,
    taskIds: [...new Set(taskIds)],
    requirementIds: [...new Set(requirementIds)],
    evidence,
    missingEvidence,
    recommendation,
    waived: false,
    waiver: null,
  };
}

function firstImplementationCommit(task, taskCommits) {
  return (
    taskCommits.find((commit) =>
      commit.files.some(
        (file) =>
          SOURCE_PATH_PATTERN.test(file.filename) &&
          !MIGRATION_PATH_PATTERN.test(file.filename) &&
          !ARCHITECTURE_PATH_PATTERN.test(file.filename),
      ),
    ) ??
    taskCommits[0] ??
    null
  );
}

function architectureReviewEvidence(task, commits, events) {
  const event = latestEvent(
    events,
    (candidate) =>
      candidate.type === 'architecture-reviewed' &&
      ['approved', 'accepted'].includes(candidate.status) &&
      (candidate.taskId === '' || candidate.taskId === task.id),
  );
  const commit = firstCommitMatching(commits, (file) =>
    ARCHITECTURE_PATH_PATTERN.test(file.filename),
  );
  const timestamps = [event?.at ?? null, commit?.timestamp ?? null].filter(Boolean);
  return {
    at: earliestDate(timestamps),
    event,
    commit,
  };
}

function isCorrectiveCommit(commit, kind) {
  return kind === 'migration'
    ? CORRECTIVE_MIGRATION_MESSAGE.test(commit.message)
    : CORRECTIVE_DEPENDENCY_MESSAGE.test(commit.message);
}

function applyWaivers(findings, events) {
  for (const finding of findings) {
    const waiver = latestEvent(
      events,
      (event) =>
        event.type === 'finding-waived' &&
        event.findingType === finding.type &&
        (event.taskId === '' || finding.taskIds.includes(event.taskId)) &&
        event.reviewer.length > 0 &&
        event.reason.length >= 12,
    );
    if (waiver !== null) {
      finding.waived = true;
      finding.waiver = {
        at: waiver.at,
        reviewer: waiver.reviewer,
        reason: waiver.reason,
      };
    }
  }
}

export function detectPlanningMistakes(input = {}) {
  const commits = commitsChronologically(normalizeArray(input.commits).map(normalizeCommit));
  const tasks = normalizeArray(input.tasks)
    .map(normalizeTask)
    .sort((a, b) => a.order - b.order);
  const requirements = normalizeArray(input.requirements).map(normalizeRequirement);
  const events = normalizeArray(input.events).map(normalizeEvent);
  const declaredScopePaths = normalizeArray(input.declaredScopePaths ?? input.scopePaths);
  const phase = normalizeString(input.phase).toLowerCase() || 'draft';
  const findings = [];
  const notices = [];
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const timingByTask = new Map();

  for (const task of tasks) {
    const relatedCommits = commitsForTask(task, commits);
    timingByTask.set(task.id, taskTiming(task, events, relatedCommits));
  }

  for (const task of tasks) {
    const relatedCommits = commitsForTask(task, commits);
    const timing = timingByTask.get(task.id);
    const implementation = firstImplementationCommit(task, relatedCommits);

    if (task.migrationRequired === true && relatedCommits.length > 0) {
      const migration = firstCommitMatching(commits, (file) =>
        MIGRATION_PATH_PATTERN.test(file.filename),
      );
      const corrective = commits.find(
        (commit) =>
          isCorrectiveCommit(commit, 'migration') &&
          commit.files.some((file) => MIGRATION_PATH_PATTERN.test(file.filename)),
      );
      if (migration === null) {
        findings.push(
          createFinding({
            type: 'forgot-migration',
            state: timing.completedAt !== null || phase === 'review' ? 'detected' : 'suspected',
            confidence: timing.completedAt !== null || phase === 'review' ? 'high' : 'medium',
            severity: 'high',
            title: `${task.id} required a migration but no migration file exists in the change history.`,
            taskIds: [task.id],
            evidence: [
              { kind: 'task-rule', migrationRequired: true },
              { kind: 'implementation-commit', sha: implementation?.sha ?? null },
            ],
            missingEvidence: ['migration-file'],
            recommendation:
              'Add and verify the required migration before the task is considered complete.',
          }),
        );
      } else if (
        timing.completedAt !== null &&
        migration.timestamp !== null &&
        Date.parse(migration.timestamp) > Date.parse(timing.completedAt)
      ) {
        findings.push(
          createFinding({
            type: 'forgot-migration',
            severity: 'high',
            title: `${task.id} was marked complete before its required migration was added.`,
            taskIds: [task.id],
            evidence: [
              { kind: 'task-completed', at: timing.completedAt },
              { kind: 'migration-commit', sha: migration.sha, at: migration.timestamp },
            ],
            recommendation:
              'Treat schema and migration work as one atomic task and complete them together.',
          }),
        );
      } else if (corrective !== undefined) {
        findings.push(
          createFinding({
            type: 'forgot-migration',
            severity: 'high',
            title: `${task.id} contains an explicit corrective commit for a missing migration.`,
            taskIds: [task.id],
            evidence: [
              { kind: 'corrective-commit', sha: corrective.sha, message: corrective.message },
            ],
            recommendation: 'Require migration planning before schema implementation starts.',
          }),
        );
      }
    }

    if (task.dependencyRequired === true && relatedCommits.length > 0) {
      const manifest = firstCommitMatching(commits, (file) =>
        MANIFEST_PATH_PATTERN.test(file.filename),
      );
      const lockfile = firstCommitMatching(commits, (file) =>
        LOCKFILE_PATH_PATTERN.test(file.filename),
      );
      const corrective = commits.find(
        (commit) =>
          isCorrectiveCommit(commit, 'dependency') &&
          commit.files.some(
            (file) =>
              MANIFEST_PATH_PATTERN.test(file.filename) ||
              LOCKFILE_PATH_PATTERN.test(file.filename),
          ),
      );
      if (manifest === null || lockfile === null) {
        const missing = [
          manifest === null ? 'dependency-manifest' : null,
          lockfile === null ? 'lockfile' : null,
        ].filter(Boolean);
        findings.push(
          createFinding({
            type: 'forgot-dependency',
            state: timing.completedAt !== null || phase === 'review' ? 'detected' : 'suspected',
            confidence: timing.completedAt !== null || phase === 'review' ? 'high' : 'medium',
            severity: 'high',
            title: `${task.id} required a dependency change but its manifest and lockfile evidence are incomplete.`,
            taskIds: [task.id],
            evidence: [
              { kind: 'task-rule', dependencyRequired: true },
              { kind: 'implementation-commit', sha: implementation?.sha ?? null },
            ],
            missingEvidence: missing,
            recommendation:
              'Update the dependency manifest and generated lockfile in the same planned change.',
          }),
        );
      } else if (
        timing.completedAt !== null &&
        [manifest, lockfile].some(
          (commit) =>
            commit.timestamp !== null &&
            Date.parse(commit.timestamp) > Date.parse(timing.completedAt),
        )
      ) {
        findings.push(
          createFinding({
            type: 'forgot-dependency',
            severity: 'high',
            title: `${task.id} was marked complete before dependency metadata was complete.`,
            taskIds: [task.id],
            evidence: [
              { kind: 'task-completed', at: timing.completedAt },
              { kind: 'manifest-commit', sha: manifest.sha, at: manifest.timestamp },
              { kind: 'lockfile-commit', sha: lockfile.sha, at: lockfile.timestamp },
            ],
            recommendation:
              'Make dependency declaration and lockfile generation part of the implementation task.',
          }),
        );
      } else if (corrective !== undefined) {
        findings.push(
          createFinding({
            type: 'forgot-dependency',
            severity: 'high',
            title: `${task.id} contains an explicit corrective commit for missing dependency metadata.`,
            taskIds: [task.id],
            evidence: [
              { kind: 'corrective-commit', sha: corrective.sha, message: corrective.message },
            ],
            recommendation:
              'Inspect dependencies and lockfile effects before implementation is marked complete.',
          }),
        );
      }
    }

    if (implementation !== null) {
      for (const dependencyId of task.dependsOn) {
        const dependency = taskById.get(dependencyId);
        if (dependency === undefined) {
          notices.push({
            type: 'insufficient-evidence',
            code: 'unknown-task-dependency',
            taskId: task.id,
            message: `${task.id} depends on unknown task ${dependencyId}.`,
          });
          continue;
        }
        const dependencyTiming = timingByTask.get(dependencyId);
        const dependencyCompletedAt = dependencyTiming?.completedAt ?? null;
        if (
          dependencyCompletedAt === null ||
          implementation.timestamp === null ||
          Date.parse(implementation.timestamp) < Date.parse(dependencyCompletedAt)
        ) {
          findings.push(
            createFinding({
              type: 'wrong-implementation-order',
              severity: 'high',
              title: `${task.id} implementation began before prerequisite ${dependencyId} was complete.`,
              taskIds: [task.id, dependencyId],
              evidence: [
                { kind: 'dependent-start', sha: implementation.sha, at: implementation.timestamp },
                {
                  kind: 'prerequisite-completion',
                  taskId: dependencyId,
                  at: dependencyCompletedAt,
                },
              ],
              missingEvidence: dependencyCompletedAt === null ? ['prerequisite-completion'] : [],
              recommendation:
                'Complete and record prerequisite tasks before dependent implementation starts.',
            }),
          );
        }
      }
    }

    if (task.architectureReviewRequired === true && implementation !== null) {
      const review = architectureReviewEvidence(task, commits, events);
      if (review.at === null) {
        findings.push(
          createFinding({
            type: 'skipped-architecture-review',
            severity: 'high',
            title: `${task.id} required architecture review but implementation began without approval evidence.`,
            taskIds: [task.id],
            evidence: [
              {
                kind: 'implementation-start',
                sha: implementation.sha,
                at: implementation.timestamp,
              },
            ],
            missingEvidence: ['approved-architecture-review'],
            recommendation: 'Record architecture approval before the first implementation commit.',
          }),
        );
      } else if (
        implementation.timestamp !== null &&
        Date.parse(review.at) > Date.parse(implementation.timestamp)
      ) {
        findings.push(
          createFinding({
            type: 'skipped-architecture-review',
            severity: 'high',
            title: `${task.id} architecture approval occurred after implementation had already begun.`,
            taskIds: [task.id],
            evidence: [
              {
                kind: 'implementation-start',
                sha: implementation.sha,
                at: implementation.timestamp,
              },
              { kind: 'architecture-review', at: review.at },
            ],
            recommendation:
              'Move architecture review ahead of implementation and preserve the approval event.',
          }),
        );
      }
    }

    const effectiveStartedAt = timing.startedAt;
    const effectiveCompletedAt = timing.completedAt;
    if (task.estimateMinutes !== null) {
      if (effectiveStartedAt === null || effectiveCompletedAt === null) {
        notices.push({
          type: 'insufficient-evidence',
          code: 'estimate-timestamps-missing',
          taskId: task.id,
          message: `${task.id} has an estimate but lacks explicit start or completion evidence.`,
        });
      } else {
        const revision = latestEvent(
          events,
          (event) =>
            event.type === 'estimate-revised' &&
            event.taskId === task.id &&
            event.estimateMinutes !== null,
          effectiveCompletedAt,
        );
        const estimateMinutes = revision?.estimateMinutes ?? task.estimateMinutes;
        const actualMinutes = Math.max(
          0,
          (Date.parse(effectiveCompletedAt) - Date.parse(effectiveStartedAt)) / 60_000,
        );
        const difference = Math.abs(actualMinutes - estimateMinutes);
        const ratio = estimateMinutes === 0 ? null : actualMinutes / estimateMinutes;
        if (difference >= 60 && (ratio > 2 || ratio < 0.25)) {
          findings.push(
            createFinding({
              type: 'wrong-estimate',
              confidence: 'medium',
              severity: 'medium',
              title: `${task.id} actual elapsed time materially diverged from its recorded estimate.`,
              taskIds: [task.id],
              evidence: [
                { kind: 'estimate', minutes: estimateMinutes, revisedAt: revision?.at ?? null },
                {
                  kind: 'elapsed-time',
                  minutes: Math.round(actualMinutes),
                  startedAt: effectiveStartedAt,
                  completedAt: effectiveCompletedAt,
                  ratio: Number(ratio.toFixed(2)),
                },
              ],
              recommendation:
                'Review estimation assumptions and record a justified estimate revision earlier.',
            }),
          );
        }
      }
    }
  }

  const requirementSatisfiedEvents = new Set(
    events
      .filter((event) => event.type === 'requirement-satisfied' && event.requirementId.length > 0)
      .map((event) => event.requirementId),
  );
  const finalFiles = [
    ...new Set(commits.flatMap((commit) => commit.files.map((file) => file.filename))),
  ];
  const allTasksCompleted =
    tasks.length > 0 && tasks.every((task) => timingByTask.get(task.id)?.completedAt !== null);
  for (const requirement of requirements) {
    const pathEvidence = requirement.requiredPaths.some((path) =>
      finalFiles.some((filename) => pathMatchesScope(filename, [path])),
    );
    const satisfied =
      requirement.satisfied === true ||
      requirement.satisfiedAt !== null ||
      requirementSatisfiedEvents.has(requirement.id) ||
      pathEvidence;
    if (!satisfied && (phase === 'review' || allTasksCompleted)) {
      findings.push(
        createFinding({
          type: 'ignored-requirement',
          severity: 'high',
          title: `${requirement.id} has no satisfaction evidence in the completed plan.`,
          requirementIds: [requirement.id],
          evidence: [
            {
              kind: 'requirement',
              text: requirement.text,
              requiredPaths: requirement.requiredPaths,
            },
            { kind: 'final-files', count: finalFiles.length },
          ],
          missingEvidence: ['requirement-satisfaction'],
          recommendation: 'Implement the requirement or explicitly defer it before review.',
        }),
      );
    } else if (!satisfied) {
      findings.push(
        createFinding({
          type: 'ignored-requirement',
          state: 'suspected',
          confidence: 'medium',
          severity: 'medium',
          title: `${requirement.id} does not yet have satisfaction evidence.`,
          requirementIds: [requirement.id],
          evidence: [{ kind: 'requirement', text: requirement.text }],
          missingEvidence: ['requirement-satisfaction'],
          recommendation: 'Record implementation evidence before moving the plan to review.',
        }),
      );
    }
  }

  if (declaredScopePaths.length === 0) {
    notices.push({
      type: 'insufficient-evidence',
      code: 'declared-scope-missing',
      message: 'No declared scope paths were available, so scope creep cannot be evaluated.',
    });
  } else {
    for (const filename of finalFiles) {
      if (pathMatchesScope(filename, declaredScopePaths)) continue;
      const firstCommit = firstCommitMatching(commits, (file) => file.filename === filename);
      const approval = latestEvent(
        events,
        (event) => event.type === 'scope-approved' && pathMatchesScope(filename, [event.path]),
      );
      if (
        approval !== null &&
        (approval.at === null ||
          firstCommit?.timestamp === null ||
          Date.parse(approval.at) <= Date.parse(firstCommit.timestamp))
      ) {
        continue;
      }
      findings.push(
        createFinding({
          type: 'scope-creep',
          confidence: 'high',
          severity: 'medium',
          title: `${filename} changed outside declared scope without prior approval.`,
          evidence: [
            {
              kind: 'out-of-scope-file',
              filename,
              sha: firstCommit?.sha ?? null,
              at: firstCommit?.timestamp ?? null,
            },
            { kind: 'scope-approval', at: approval?.at ?? null, path: approval?.path ?? null },
          ],
          recommendation:
            'Approve the scope expansion before the first out-of-scope change or remove the change.',
        }),
      );
    }
  }

  applyWaivers(findings, events);
  const blockers = findings.filter(
    (finding) => finding.state === 'detected' && finding.confidence === 'high' && !finding.waived,
  );
  const suspected = findings.filter((finding) => finding.state === 'suspected' && !finding.waived);
  const status =
    blockers.length > 0
      ? 'detected'
      : suspected.length > 0
        ? 'review-required'
        : notices.length > 0
          ? 'insufficient-evidence'
          : 'clear';

  return {
    schemaVersion: 1,
    status,
    phase,
    summary: {
      blockers: blockers.length,
      detected: findings.filter((finding) => finding.state === 'detected').length,
      suspected: findings.filter((finding) => finding.state === 'suspected').length,
      waived: findings.filter((finding) => finding.waived).length,
      notices: notices.length,
    },
    findings,
    blockers: blockers.map((finding) => finding.id),
    notices,
  };
}
