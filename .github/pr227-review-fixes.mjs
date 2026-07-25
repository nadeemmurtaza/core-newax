import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content);
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index === -1) {
    throw new Error(`Missing transformation anchor: ${label}`);
  }
  if (source.indexOf(search, index + search.length) !== -1) {
    throw new Error(`Transformation anchor is not unique: ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replacePattern(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (matches === null) {
    throw new Error(`Missing transformation pattern: ${label}`);
  }
  return source.replace(pattern, replacement);
}

function transformPlanningHistory() {
  const path = 'tooling/planning-history-github.mjs';
  let source = read(path);
  source = replaceOnce(
    source,
    `} from './engineering-learning-core.mjs';\n\nfunction normalizeString`,
    `} from './engineering-learning-core.mjs';\n\nconst AUTHORIZED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);\n\nfunction normalizeString`,
    'planning history authorized associations',
  );
  source = replacePattern(
    source,
    /function eventFromMetadata\(metadata, createdAt, issueNumber\) \{[\s\S]*?\n\}\n\nexport function parsePlanningIssue/,
    `function eventFromMetadata(metadata, sourceRecord, issueNumber) {\n  const actor = normalizeString(sourceRecord?.user?.login);\n  const authorAssociation = normalizeString(\n    sourceRecord?.author_association ?? sourceRecord?.authorAssociation,\n  ).toUpperCase();\n  return {\n    type: metadata.event,\n    taskId: metadata['task-id'],\n    requirementId: metadata['requirement-id'],\n    findingType: metadata['finding-type'],\n    at: metadata.at ?? sourceRecord?.created_at ?? sourceRecord?.createdAt,\n    status: metadata.status,\n    path: metadata.path ?? metadata.scope,\n    estimateMinutes: metadata['estimate-minutes'] ?? metadata.estimate,\n    reviewer: actor,\n    declaredReviewer: metadata.reviewer ?? metadata['approved-by'],\n    actor,\n    authorAssociation,\n    authorized: actor.length > 0 && AUTHORIZED_ASSOCIATIONS.has(authorAssociation),\n    reason: metadata.reason,\n    issueNumber,\n  };\n}\n\nexport function parsePlanningIssue`,
    'planning event actor provenance',
  );
  source = replaceOnce(
    source,
    `  const bodyEvents = parseKeyValueBlock(body, 'newax-planning-event').map((metadata) =>\n    eventFromMetadata(metadata, issue.created_at ?? issue.createdAt, issueNumber),\n  );\n  const commentEvents = comments.flatMap((comment) =>\n    parseKeyValueBlock(comment.body, 'newax-planning-event').map((metadata) =>\n      eventFromMetadata(metadata, comment.created_at ?? comment.createdAt, issueNumber),\n    ),\n  );`,
    `  const bodyEvents = parseKeyValueBlock(body, 'newax-planning-event').map((metadata) =>\n    eventFromMetadata(metadata, issue, issueNumber),\n  );\n  const commentEvents = comments.flatMap((comment) =>\n    parseKeyValueBlock(comment.body, 'newax-planning-event').map((metadata) =>\n      eventFromMetadata(metadata, comment, issueNumber),\n    ),\n  );`,
    'planning event source records',
  );
  source = replacePattern(
    source,
    /export function parsePlanningIssueNumbers\(pullRequestBody\) \{[\s\S]*?\n\}\n\nfunction combinePlans/,
    `export function planningEvidenceState(pullRequestBody) {\n  const fieldValue = parsePullRequestField(pullRequestBody, '- Planning issues:');\n  const normalized = normalizeString(fieldValue)\n    .replace(/^\x60|\x60$/g, '')\n    .trim();\n  const exempt = normalized.toLowerCase() === 'not-required';\n  const templatePlaceholder =\n    normalized === '#123' &&\n    /Planning issues:\\s*\x60#123\x60, comma-separated issues/.test(\n      String(pullRequestBody ?? ''),\n    );\n  return { exempt, templatePlaceholder, fieldValue };\n}\n\nexport function parsePlanningIssueNumbers(pullRequestBody) {\n  const state = planningEvidenceState(pullRequestBody);\n  if (state.exempt || state.templatePlaceholder) {\n    return [];\n  }\n  if (state.fieldValue !== null) {\n    return parseIssueNumbers(state.fieldValue);\n  }\n  const matches = String(pullRequestBody ?? '').matchAll(\n    /planning issue(?:s)?\\s*[:#]?\\s*#(\\d+)/gi,\n  );\n  return [...new Set([...matches].map((match) => Number(match[1])).filter(Number.isSafeInteger))];\n}\n\nfunction combinePlans`,
    'planning exemption and placeholder parsing',
  );
  source = replaceOnce(
    source,
    `export async function collectPlanningHistory({ pullRequest, request = githubRequest }) {`,
    `async function collectCommitDetail(sha, request) {\n  let detail = null;\n  const files = [];\n  for (let page = 1; page <= 20; page += 1) {\n    const response = await request(\`/commits/\${sha}?per_page=100&page=\${page}\`);\n    detail ??= response;\n    const pageFiles = Array.isArray(response?.files) ? response.files : [];\n    files.push(...pageFiles);\n    if (pageFiles.length < 100) {\n      break;\n    }\n  }\n  return { ...(detail ?? {}), files };\n}\n\nexport async function collectPlanningHistory({ pullRequest, request = githubRequest }) {`,
    'commit detail pagination helper',
  );
  source = replaceOnce(
    source,
    `    const detail = await request(\`/commits/\${summary.sha}\`);`,
    `    const detail = await collectCommitDetail(summary.sha, request);`,
    'paginated commit detail request',
  );
  source = replaceOnce(
    source,
    `  const issueNumbers = parsePlanningIssueNumbers(pullRequest.body ?? '');`,
    `  const planningState = planningEvidenceState(pullRequest.body ?? '');\n  const issueNumbers = parsePlanningIssueNumbers(pullRequest.body ?? '');`,
    'planning state collection',
  );
  source = replaceOnce(
    source,
    `    phase: pullRequest.draft === true ? 'draft' : 'review',`,
    `    phase: pullRequest.draft === true ? 'draft' : 'review',\n    planningExempt: planningState.exempt,`,
    'planning exemption history output',
  );
  write(path, source);
}

function transformDetector() {
  const path = 'tooling/planning-mistake-detector.mjs';
  let source = read(path);
  source = replaceOnce(
    source,
    `  return {\n    filename,\n    status: normalizeString(file.status).toLowerCase() || 'modified',\n    patch: typeof file.patch === 'string' ? file.patch : '',\n  };`,
    `  return {\n    filename,\n    previousFilename: normalizeString(file.previousFilename ?? file.previous_filename),\n    status: normalizeString(file.status).toLowerCase() || 'modified',\n    patch: typeof file.patch === 'string' ? file.patch : '',\n  };`,
    'normalize previous filename',
  );
  source = replaceOnce(
    source,
    `function normalizeTask(task, index) {`,
    `function scopedReference(issueNumber, id) {\n  return issueNumber === null ? id : \`#\${issueNumber}:\${id}\`;\n}\n\nfunction taskReference(task) {\n  return scopedReference(task.issueNumber, task.id);\n}\n\nfunction requirementReference(requirement) {\n  return scopedReference(requirement.issueNumber, requirement.id);\n}\n\nfunction eventTaskReference(event) {\n  return scopedReference(event.issueNumber, event.taskId);\n}\n\nfunction eventMatchesTask(event, task) {\n  return event.taskId === task.id && event.issueNumber === task.issueNumber;\n}\n\nfunction eventAppliesToTask(event, task) {\n  return event.issueNumber === task.issueNumber && (event.taskId === '' || event.taskId === task.id);\n}\n\nfunction eventMatchesRequirement(event, requirement) {\n  return event.requirementId === requirement.id && event.issueNumber === requirement.issueNumber;\n}\n\nfunction filePaths(file) {\n  return [file.filename, file.previousFilename].filter(Boolean);\n}\n\nfunction finalFileNames(commits) {\n  const files = new Set();\n  for (const commit of commits) {\n    for (const file of commit.files) {\n      if (file.status === 'renamed' && file.previousFilename.length > 0) {\n        files.delete(file.previousFilename);\n      }\n      if (['removed', 'deleted'].includes(file.status)) {\n        files.delete(file.filename);\n      } else {\n        files.add(file.filename);\n      }\n    }\n  }\n  return [...files];\n}\n\nfunction changedFileNames(commits) {\n  return [\n    ...new Set(\n      commits.flatMap((commit) => commit.files.flatMap((file) => filePaths(file))),\n    ),\n  ];\n}\n\nfunction normalizeTask(task, index) {`,
    'scoped planning identities and file state helpers',
  );
  source = replacePattern(
    source,
    /function normalizeTask\(task, index\) \{[\s\S]*?\n\}\n\nfunction normalizeRequirement/,
    `function normalizeTask(task, index) {\n  if (task === null || typeof task !== 'object' || Array.isArray(task)) {\n    throw new TypeError(\`tasks[\${index}] must be an object.\`);\n  }\n  const id = normalizeString(task.id ?? task.taskId);\n  if (id.length === 0) {\n    throw new TypeError(\`tasks[\${index}] requires id.\`);\n  }\n  const issueNumber = Number.isSafeInteger(Number(task.issueNumber))\n    ? Number(task.issueNumber)\n    : null;\n  const estimate = Number(task.estimateMinutes ?? task.estimate);\n  return {\n    id,\n    key: scopedReference(issueNumber, id),\n    title: normalizeString(task.title),\n    order: Number.isFinite(Number(task.order)) ? Number(task.order) : index + 1,\n    dependsOn: normalizeArray(task.dependsOn ?? task.depends),\n    estimateMinutes: Number.isFinite(estimate) && estimate > 0 ? estimate : null,\n    startedAt: normalizeDate(task.startedAt),\n    completedAt: normalizeDate(task.completedAt),\n    scopePaths: normalizeArray(task.scopePaths ?? task.scope),\n    migrationRequired: normalizeBoolean(task.migrationRequired ?? task.migration),\n    dependencyRequired: normalizeBoolean(task.dependencyRequired ?? task.dependency),\n    architectureReviewRequired: normalizeBoolean(\n      task.architectureReviewRequired ?? task.architectureReview,\n    ),\n    requirementIds: normalizeArray(task.requirementIds ?? task.requirements),\n    issueNumber,\n  };\n}\n\nfunction normalizeRequirement`,
    'normalized task identity',
  );
  source = replacePattern(
    source,
    /function normalizeRequirement\(requirement, index\) \{[\s\S]*?\n\}\n\nfunction normalizeEvent/,
    `function normalizeRequirement(requirement, index) {\n  if (requirement === null || typeof requirement !== 'object' || Array.isArray(requirement)) {\n    throw new TypeError(\`requirements[\${index}] must be an object.\`);\n  }\n  const id = normalizeString(requirement.id ?? requirement.requirementId);\n  if (id.length === 0) {\n    throw new TypeError(\`requirements[\${index}] requires id.\`);\n  }\n  const issueNumber = Number.isSafeInteger(Number(requirement.issueNumber))\n    ? Number(requirement.issueNumber)\n    : null;\n  return {\n    id,\n    key: scopedReference(issueNumber, id),\n    text: normalizeString(requirement.text ?? requirement.title),\n    requiredPaths: normalizeArray(requirement.requiredPaths ?? requirement.paths),\n    satisfied: normalizeBoolean(requirement.satisfied ?? requirement.complete),\n    satisfiedAt: normalizeDate(requirement.satisfiedAt),\n    issueNumber,\n  };\n}\n\nfunction normalizeEvent`,
    'normalized requirement identity',
  );
  source = replacePattern(
    source,
    /function normalizeEvent\(event, index\) \{[\s\S]*?\n\}\n\nfunction patternToRegExp/,
    `function normalizeEvent(event, index) {\n  if (event === null || typeof event !== 'object' || Array.isArray(event)) {\n    throw new TypeError(\`events[\${index}] must be an object.\`);\n  }\n  const issueNumber = Number.isSafeInteger(Number(event.issueNumber))\n    ? Number(event.issueNumber)\n    : null;\n  const actor = normalizeString(event.actor);\n  return {\n    type: normalizeString(event.type ?? event.event).toLowerCase(),\n    taskId: normalizeString(event.taskId ?? event['task-id']),\n    requirementId: normalizeString(event.requirementId ?? event['requirement-id']),\n    findingType: normalizeString(event.findingType ?? event['finding-type']).toLowerCase(),\n    at: normalizeDate(event.at ?? event.createdAt ?? event.created_at),\n    status: normalizeString(event.status).toLowerCase(),\n    path: normalizeString(event.path ?? event.scope),\n    estimateMinutes: Number.isFinite(Number(event.estimateMinutes ?? event.estimate))\n      ? Number(event.estimateMinutes ?? event.estimate)\n      : null,\n    actor,\n    reviewer: actor,\n    authorAssociation: normalizeString(event.authorAssociation).toUpperCase(),\n    authorized: event.authorized === true,\n    reason: normalizeString(event.reason),\n    issueNumber,\n  };\n}\n\nfunction patternToRegExp`,
    'normalized event provenance',
  );
  source = replacePattern(
    source,
    /function commitsForTask\(task, commits\) \{[\s\S]*?\n\}\n\nfunction latestEvent/,
    `function commitsForTask(task, commits) {\n  if (task.scopePaths.length === 0) {\n    return [];\n  }\n  return commits.filter((commit) =>\n    commit.files.some((file) =>\n      filePaths(file).some((filename) => pathMatchesScope(filename, task.scopePaths)),\n    ),\n  );\n}\n\nfunction latestEvent`,
    'task scoped current and previous filenames',
  );
  source = replaceOnce(
    source,
    `          before === null || event.at === null || Date.parse(event.at) <= Date.parse(before),`,
    `          before === null || (event.at !== null && Date.parse(event.at) <= Date.parse(before)),`,
    'timestamp-bounded event lookup',
  );
  source = replacePattern(
    source,
    /function taskTiming\(task, events, taskCommits\) \{[\s\S]*?\n\}\n\nfunction stableFindingId/,
    `function taskTiming(task, events, taskCommits) {\n  const startedEvents = events.filter(\n    (event) => eventMatchesTask(event, task) && event.type === 'task-started',\n  );\n  const completedEvents = events.filter(\n    (event) => eventMatchesTask(event, task) && event.type === 'task-completed',\n  );\n  const firstCommitAt = taskCommits.find((commit) => commit.timestamp !== null)?.timestamp ?? null;\n  const lastCommitAt =\n    [...taskCommits].reverse().find((commit) => commit.timestamp !== null)?.timestamp ?? null;\n  return {\n    firstCommitAt,\n    lastCommitAt,\n    startedAt: earliestDate([\n      task.startedAt,\n      ...startedEvents.map((event) => event.at),\n      firstCommitAt,\n    ]),\n    completedAt: latestDate([task.completedAt, ...completedEvents.map((event) => event.at)]),\n  };\n}\n\nfunction stableFindingId`,
    'task event namespacing',
  );
  source = replacePattern(
    source,
    /function architectureReviewEvidence\(task, commits, events\) \{[\s\S]*?\n\}\n\nfunction isCorrectiveCommit/,
    `function architectureReviewEvidence(task, commits, events, implementationAt) {\n  const event = latestEvent(\n    events,\n    (candidate) =>\n      candidate.authorized &&\n      candidate.type === 'architecture-reviewed' &&\n      ['approved', 'accepted'].includes(candidate.status) &&\n      eventAppliesToTask(candidate, task),\n    implementationAt,\n  );\n  const commit = firstCommitMatching(commits, (file) =>\n    ARCHITECTURE_PATH_PATTERN.test(file.filename),\n  );\n  const timestamps = [event?.at ?? null, commit?.timestamp ?? null].filter(Boolean);\n  return {\n    at: earliestDate(timestamps),\n    event,\n    commit,\n  };\n}\n\nfunction isCorrectiveCommit`,
    'authorized prior architecture evidence',
  );
  source = replacePattern(
    source,
    /function applyWaivers\(findings, events\) \{[\s\S]*?\n\}\n\nexport function detectPlanningMistakes/,
    `function applyWaivers(findings, events) {\n  for (const finding of findings) {\n    const waiver = latestEvent(\n      events,\n      (event) =>\n        event.authorized &&\n        event.type === 'finding-waived' &&\n        event.findingType === finding.type &&\n        (event.taskId === '' || finding.taskIds.includes(eventTaskReference(event))) &&\n        event.reviewer.length > 0 &&\n        event.reason.length >= 12,\n    );\n    if (waiver !== null) {\n      finding.waived = true;\n      finding.waiver = {\n        at: waiver.at,\n        reviewer: waiver.reviewer,\n        reason: waiver.reason,\n      };\n    }\n  }\n}\n\nexport function detectPlanningMistakes`,
    'authorized finding waivers',
  );
  source = replaceOnce(
    source,
    `  const taskById = new Map(tasks.map((task) => [task.id, task]));`,
    `  const taskByKey = new Map(tasks.map((task) => [task.key, task]));`,
    'namespaced task map',
  );
  source = source.replaceAll('timingByTask.set(task.id,', 'timingByTask.set(task.key,');
  source = source.replaceAll('timingByTask.get(task.id)', 'timingByTask.get(task.key)');
  source = source.replaceAll('taskIds: [task.id],', 'taskIds: [taskReference(task)],');
  source = source.replaceAll('taskId: task.id,', 'taskId: taskReference(task),');
  source = replaceOnce(
    source,
    `    if (task.migrationRequired === true && relatedCommits.length > 0) {\n      const migration = firstCommitMatching(commits, (file) =>`,
    `    if (task.migrationRequired === true) {\n      const migration = firstCommitMatching(relatedCommits, (file) =>`,
    'task scoped migration evidence and missing-commit check',
  );
  source = replaceOnce(
    source,
    `      const corrective = commits.find(\n        (commit) =>\n          isCorrectiveCommit(commit, 'migration')`,
    `      const corrective = relatedCommits.find(\n        (commit) =>\n          isCorrectiveCommit(commit, 'migration')`,
    'task scoped corrective migration',
  );
  source = replaceOnce(
    source,
    `    if (task.dependencyRequired === true && relatedCommits.length > 0) {\n      const manifest = firstCommitMatching(commits, (file) =>\n        MANIFEST_PATH_PATTERN.test(file.filename),\n      );\n      const lockfile = firstCommitMatching(commits, (file) =>`,
    `    if (task.dependencyRequired === true) {\n      const manifest = firstCommitMatching(relatedCommits, (file) =>\n        MANIFEST_PATH_PATTERN.test(file.filename),\n      );\n      const lockfile = firstCommitMatching(relatedCommits, (file) =>`,
    'task scoped dependency evidence and missing-commit check',
  );
  source = replaceOnce(
    source,
    `      const corrective = commits.find(\n        (commit) =>\n          isCorrectiveCommit(commit, 'dependency')`,
    `      const corrective = relatedCommits.find(\n        (commit) =>\n          isCorrectiveCommit(commit, 'dependency')`,
    'task scoped corrective dependency',
  );
  source = replacePattern(
    source,
    /      for \(const dependencyId of task\.dependsOn\) \{[\s\S]*?\n      \}\n    \}\n\n    if \(task\.architectureReviewRequired/,
    `      for (const dependencyId of task.dependsOn) {\n        const dependencyKey = scopedReference(task.issueNumber, dependencyId);\n        const dependency = taskByKey.get(dependencyKey);\n        if (dependency === undefined) {\n          notices.push({\n            type: 'insufficient-evidence',\n            code: 'unknown-task-dependency',\n            taskId: taskReference(task),\n            message: \`\${taskReference(task)} depends on unknown task \${dependencyId}.\`,\n          });\n          continue;\n        }\n        const dependencyTiming = timingByTask.get(dependency.key);\n        const dependencyCompletedAt = dependencyTiming?.completedAt ?? null;\n        if (\n          dependencyCompletedAt === null ||\n          implementation.timestamp === null ||\n          Date.parse(implementation.timestamp) < Date.parse(dependencyCompletedAt)\n        ) {\n          findings.push(\n            createFinding({\n              type: 'wrong-implementation-order',\n              severity: 'high',\n              title: \`\${taskReference(task)} implementation began before prerequisite \${taskReference(dependency)} was complete.\`,\n              taskIds: [taskReference(task), taskReference(dependency)],\n              evidence: [\n                { kind: 'dependent-start', sha: implementation.sha, at: implementation.timestamp },\n                {\n                  kind: 'prerequisite-completion',\n                  taskId: taskReference(dependency),\n                  at: dependencyCompletedAt,\n                },\n              ],\n              missingEvidence: dependencyCompletedAt === null ? ['prerequisite-completion'] : [],\n              recommendation:\n                'Complete and record prerequisite tasks before dependent implementation starts.',\n            }),\n          );\n        }\n      }\n    }\n\n    if (task.architectureReviewRequired`,
    'namespaced task dependency evaluation',
  );
  source = replaceOnce(
    source,
    `      const review = architectureReviewEvidence(task, commits, events);`,
    `      const review = architectureReviewEvidence(task, relatedCommits, events, implementation.timestamp);`,
    'task scoped prior architecture review lookup',
  );
  source = replaceOnce(
    source,
    `            event.type === 'estimate-revised' &&\n            event.taskId === task.id &&\n            event.estimateMinutes !== null,`,
    `            event.authorized &&\n            event.type === 'estimate-revised' &&\n            eventMatchesTask(event, task) &&\n            event.estimateMinutes !== null,`,
    'authorized scoped estimate revisions',
  );
  source = replacePattern(
    source,
    /  const requirementSatisfiedEvents = new Set\([\s\S]*?\n  for \(const requirement of requirements\) \{/,
    `  const requirementSatisfiedEvents = new Set(\n    events\n      .filter(\n        (event) => event.type === 'requirement-satisfied' && event.requirementId.length > 0,\n      )\n      .map((event) => scopedReference(event.issueNumber, event.requirementId)),\n  );\n  const finalFiles = finalFileNames(commits);\n  const changedFiles = changedFileNames(commits);\n  const allTasksCompleted =\n    tasks.length > 0 && tasks.every((task) => timingByTask.get(task.key)?.completedAt !== null);\n  for (const requirement of requirements) {`,
    'final file state and scoped requirement events',
  );
  source = replaceOnce(
    source,
    `      requirementSatisfiedEvents.has(requirement.id) ||`,
    `      requirementSatisfiedEvents.has(requirement.key) ||`,
    'scoped requirement satisfaction',
  );
  source = source.replaceAll('requirementIds: [requirement.id],', 'requirementIds: [requirementReference(requirement)],');
  source = replaceOnce(
    source,
    `    for (const filename of finalFiles) {`,
    `    for (const filename of changedFiles) {`,
    'scope creep includes deleted and renamed paths',
  );
  source = replaceOnce(
    source,
    `      const firstCommit = firstCommitMatching(commits, (file) => file.filename === filename);\n      const approval = latestEvent(\n        events,\n        (event) => event.type === 'scope-approved' && pathMatchesScope(filename, [event.path]),\n      );`,
    `      const firstCommit = firstCommitMatching(commits, (file) =>\n        filePaths(file).includes(filename),\n      );\n      const approval =\n        firstCommit?.timestamp === null || firstCommit === null\n          ? null\n          : latestEvent(\n              events,\n              (event) =>\n                event.authorized &&\n                event.type === 'scope-approved' &&\n                event.path.length > 0 &&\n                pathMatchesScope(filename, [event.path]),\n              firstCommit.timestamp,\n            );`,
    'authorized prior scope approval and rename source evidence',
  );
  source = replacePattern(
    source,
    /      if \(\n        approval !== null &&[\s\S]*?\n      \) \{\n        continue;\n      \}/,
    `      if (approval !== null) {\n        continue;\n      }`,
    'prior scope approval acceptance',
  );
  write(path, source);
}

function transformAnalysis() {
  const path = 'tooling/planning-mistake-analysis.mjs';
  let source = read(path);
  source = replaceOnce(
    source,
    `function eventTaskId(event) {\n  return String(event?.taskId ?? event?.['task-id'] ?? '').trim();\n}\n`,
    `function eventTaskId(event) {\n  return String(event?.taskId ?? event?.['task-id'] ?? '').trim();\n}\n\nfunction eventIssueNumber(event) {\n  return Number.isSafeInteger(Number(event?.issueNumber)) ? Number(event.issueNumber) : null;\n}\n\nfunction eventAuthorized(event) {\n  return event?.authorized === true;\n}\n\nfunction eventTaskReference(event) {\n  const id = eventTaskId(event);\n  const issueNumber = eventIssueNumber(event);\n  return issueNumber === null ? id : \`#\${issueNumber}:\${id}\`;\n}\n`,
    'analysis event identity and authorization',
  );
  source = replacePattern(
    source,
    /function commitFiles\(commit\) \{[\s\S]*?\n\}/,
    `function commitFiles(commit) {\n  return asArray(commit?.files).flatMap((file) => {\n    if (typeof file === 'string') {\n      return [file];\n    }\n    return [file?.filename ?? file?.path, file?.previousFilename ?? file?.previous_filename].filter(\n      (filename) => typeof filename === 'string' && filename.length > 0,\n    );\n  });\n}`,
    'analysis current and previous commit paths',
  );
  source = replaceOnce(
    source,
    `          eventType(event) === 'architecture-reviewed' &&\n          ['approved', 'accepted'].includes(eventStatus(event)) &&\n          (eventTaskId(event) === '' || eventTaskId(event) === taskId),`,
    `          eventAuthorized(event) &&\n          eventType(event) === 'architecture-reviewed' &&\n          ['approved', 'accepted'].includes(eventStatus(event)) &&\n          (eventTaskId(event) === '' || eventTaskReference(event) === taskId),`,
    'analysis authorized architecture event',
  );
  source = replaceOnce(
    source,
    `          eventType(event) === 'scope-approved' &&`,
    `          eventAuthorized(event) &&\n          eventType(event) === 'scope-approved' &&`,
    'analysis authorized scope event',
  );
  write(path, source);
}

function transformGovernanceAndTemplate() {
  const governancePath = 'tooling/verify-pr-planning.mjs';
  let governance = read(governancePath);
  governance = replaceOnce(
    governance,
    `  const errors = [];\n  if ((history.planningIssues ?? []).length === 0 && history.phase === 'review') {`,
    `  const errors = [];\n  const planningRequired = history.phase === 'review' && history.planningExempt !== true;\n  if ((history.planningIssues ?? []).length === 0 && planningRequired) {`,
    'planning exemption issue requirement',
  );
  governance = governance.replaceAll(`&& history.phase === 'review')`, `&& planningRequired)`);
  write(governancePath, governance);

  const templatePath = '.github/pull_request_template.md';
  let template = read(templatePath);
  template = replaceOnce(
    template,
    '- Planning issues: `#123`, comma-separated issues, or `not-required` only for an explicitly exempt maintenance change',
    '- Planning issues: `#ISSUE`, comma-separated issues, or `not-required` only for an explicitly exempt maintenance change',
    'nonnumeric planning placeholder',
  );
  write(templatePath, template);
}

function transformTests() {
  const historyPath = 'tooling/planning-history-github.test.mjs';
  let history = read(historyPath);
  history = replaceOnce(
    history,
    `    created_at: '2026-01-01T08:00:00Z',`,
    `    created_at: '2026-01-01T08:00:00Z',\n    user: { login: 'planner' },\n    author_association: 'MEMBER',`,
    'planning issue actor test fixture',
  );
  history = replaceOnce(
    history,
    `      created_at: '2026-01-01T09:00:00Z',`,
    `      created_at: '2026-01-01T09:00:00Z',\n      user: { login: 'architect' },\n      author_association: 'MEMBER',`,
    'planning comment actor test fixture',
  );
  history = replaceOnce(
    history,
    `  assert.equal(plan.events[0].at, '2026-01-01T09:00:00Z');`,
    `  assert.equal(plan.events[0].at, '2026-01-01T09:00:00Z');\n  assert.equal(plan.events[0].actor, 'architect');\n  assert.equal(plan.events[0].authorized, true);`,
    'planning actor assertions',
  );
  history = replaceOnce(
    history,
    `  assert.deepEqual(parsePlanningIssueNumbers('Planning issue #12'), [12]);`,
    `  assert.deepEqual(parsePlanningIssueNumbers('Planning issue #12'), [12]);\n  assert.deepEqual(parsePlanningIssueNumbers('- Planning issues: not-required'), []);\n  assert.deepEqual(\n    parsePlanningIssueNumbers(\n      '- Planning issues: \\`#123\\`, comma-separated issues, or \\`not-required\\` only for an explicitly exempt maintenance change',\n    ),\n    [],\n  );`,
    'planning exemption and placeholder parser tests',
  );
  history = history.replace("'/commits/abc',", "'/commits/abc?per_page=100&page=1',");
  history += `\n\ntest('paginates every changed file for a commit', async () => {\n  const firstPage = Array.from({ length: 100 }, (_, index) => ({\n    filename: \`src/file-\${index}.ts\`,\n    status: 'modified',\n  }));\n  const responses = new Map([\n    ['/pulls/12/commits', [{ sha: 'large', commit: { message: 'Large change' } }]],\n    [\n      '/commits/large?per_page=100&page=1',\n      { commit: { message: 'Large change' }, files: firstPage },\n    ],\n    [\n      '/commits/large?per_page=100&page=2',\n      { commit: { message: 'Large change' }, files: [{ filename: 'src/file-100.ts', status: 'added' }] },\n    ],\n  ]);\n  const request = async (path) => {\n    if (!responses.has(path)) {\n      throw new Error(\`Unexpected path \${path}\`);\n    }\n    return responses.get(path);\n  };\n  const result = await collectPlanningHistory({\n    pullRequest: { number: 12, draft: true, body: '- Planning issues: not-required' },\n    request,\n  });\n  assert.equal(result.commits[0].files.length, 101);\n  assert.equal(result.planningExempt, true);\n});\n\ntest('does not trust author-written reviewer identities', () => {\n  const plan = parsePlanningIssue(\n    {\n      number: 10,\n      user: { login: 'author' },\n      author_association: 'NONE',\n      body: \`## Task sequence\n- TASK-1 | order=1 | depends=none | estimate=15 | scope=src | architecture-review=yes | migration=no | dependency=no | requirements=none\`,\n    },\n    [\n      {\n        user: { login: 'contributor' },\n        author_association: 'NONE',\n        created_at: '2026-01-01T09:00:00Z',\n        body: \`<!-- newax-planning-event\nevent: architecture-reviewed\ntask-id: TASK-1\nstatus: approved\nreviewer: administrator\n-->\`,\n      },\n    ],\n  );\n  assert.equal(plan.events[0].reviewer, 'contributor');\n  assert.equal(plan.events[0].authorized, false);\n});\n`;
  write(historyPath, history);

  const detectorPath = 'tooling/planning-mistake-detector.test.mjs';
  let detector = read(detectorPath);
  detector = detector.replaceAll(
    `        status: 'approved',\n        at:`,
    `        status: 'approved',\n        actor: 'architect',\n        authorized: true,\n        at:`,
  );
  detector = detector.replaceAll(
    `        estimateMinutes: 240,\n        at:`,
    `        estimateMinutes: 240,\n        actor: 'architect',\n        authorized: true,\n        at:`,
  );
  detector = detector.replaceAll(
    `        path: 'docs',\n        at:`,
    `        path: 'docs',\n        actor: 'reviewer',\n        authorized: true,\n        at:`,
  );
  detector = detector.replaceAll(
    `        reviewer: 'architect',\n        reason:`,
    `        actor: 'architect',\n        reviewer: 'spoofed-value-is-ignored',\n        authorized: true,\n        reason:`,
  );
  detector += `\n\ntest('detects required migration even when no scoped commit exists', () => {\n  const result = detectPlanningMistakes({\n    phase: 'review',\n    declaredScopePaths: ['apps/api/prisma/migrations/**'],\n    tasks: [\n      {\n        id: 'TASK-1',\n        scope: ['apps/api/prisma/migrations/**'],\n        migrationRequired: true,\n      },\n    ],\n  });\n  assert.equal(find(result, 'forgot-migration').state, 'detected');\n});\n\ntest('does not let another task migration satisfy the requiring task', () => {\n  const result = detectPlanningMistakes({\n    phase: 'review',\n    declaredScopePaths: ['apps/a/**', 'apps/b/**'],\n    commits: [commit('migration-a', '2026-01-01T10:00:00Z', ['apps/a/migrations/001.sql'])],\n    tasks: [\n      { id: 'TASK-A', scope: ['apps/a/**'], migrationRequired: true },\n      { id: 'TASK-B', scope: ['apps/b/**'], migrationRequired: true },\n    ],\n  });\n  const findings = result.findings.filter((finding) => finding.type === 'forgot-migration');\n  assert.equal(findings.some((finding) => finding.title.startsWith('TASK-A required')), false);\n  assert.equal(findings.some((finding) => finding.title.startsWith('TASK-B required')), true);\n});\n\ntest('detects required dependency metadata even when no scoped commit exists', () => {\n  const result = detectPlanningMistakes({\n    phase: 'review',\n    declaredScopePaths: ['apps/api/package.json', 'pnpm-lock.yaml'],\n    tasks: [\n      {\n        id: 'TASK-1',\n        scope: ['apps/api/package.json', 'pnpm-lock.yaml'],\n        dependencyRequired: true,\n      },\n    ],\n  });\n  assert.deepEqual(find(result, 'forgot-dependency').missingEvidence.sort(), [\n    'dependency-manifest',\n    'lockfile',\n  ]);\n});\n\ntest('does not let another package dependency metadata satisfy the requiring task', () => {\n  const result = detectPlanningMistakes({\n    phase: 'review',\n    declaredScopePaths: ['apps/a/**', 'apps/b/**', 'pnpm-lock.yaml'],\n    commits: [\n      commit('a', '2026-01-01T10:00:00Z', ['apps/a/package.json', 'pnpm-lock.yaml']),\n    ],\n    tasks: [\n      { id: 'TASK-A', scope: ['apps/a/**', 'pnpm-lock.yaml'], dependencyRequired: true },\n      { id: 'TASK-B', scope: ['apps/b/**'], dependencyRequired: true },\n    ],\n  });\n  const findings = result.findings.filter((finding) => finding.type === 'forgot-dependency');\n  assert.equal(findings.some((finding) => finding.title.startsWith('TASK-A required')), false);\n  assert.equal(findings.some((finding) => finding.title.startsWith('TASK-B required')), true);\n});\n\ntest('namespaces repeated task IDs by planning issue', () => {\n  const result = detectPlanningMistakes({\n    declaredScopePaths: ['src/a', 'src/b', 'src/c'],\n    commits: [commit('c', '2026-01-01T11:00:00Z', ['src/c/index.ts'])],\n    tasks: [\n      { id: 'TASK-1', issueNumber: 1, scope: ['src/a'], completedAt: '2026-01-01T10:00:00Z' },\n      { id: 'TASK-1', issueNumber: 2, scope: ['src/b'], completedAt: '2026-01-01T12:00:00Z' },\n      { id: 'TASK-2', issueNumber: 1, scope: ['src/c'], dependsOn: ['TASK-1'] },\n    ],\n  });\n  assert.equal(find(result, 'wrong-implementation-order'), undefined);\n});\n\ntest('rejects spoofed waivers and accepts authorized GitHub actors', () => {\n  const base = {\n    declaredScopePaths: ['src'],\n    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts', 'docs/unplanned.md'])],\n  };\n  const spoofed = detectPlanningMistakes({\n    ...base,\n    events: [\n      {\n        event: 'finding-waived',\n        findingType: 'scope-creep',\n        reviewer: 'administrator',\n        actor: 'contributor',\n        authorized: false,\n        reason: 'Attempt to waive without repository authority.',\n        at: '2026-01-01T11:00:00Z',\n      },\n    ],\n  });\n  assert.equal(find(spoofed, 'scope-creep').waived, false);\n  const authorized = detectPlanningMistakes({\n    ...base,\n    events: [\n      {\n        event: 'finding-waived',\n        findingType: 'scope-creep',\n        actor: 'maintainer',\n        authorized: true,\n        reason: 'Approved documentation evidence outside implementation scope.',\n        at: '2026-01-01T11:00:00Z',\n      },\n    ],\n  });\n  assert.equal(find(authorized, 'scope-creep').waived, true);\n  assert.equal(find(authorized, 'scope-creep').waiver.reviewer, 'maintainer');\n});\n\ntest('preserves an architecture approval recorded before a later approval', () => {\n  const result = detectPlanningMistakes({\n    declaredScopePaths: ['src'],\n    commits: [commit('a', '2026-01-01T10:00:00Z', ['src/a.ts'])],\n    tasks: [{ id: 'TASK-1', scope: ['src'], architectureReviewRequired: true }],\n    events: [\n      { event: 'architecture-reviewed', taskId: 'TASK-1', status: 'approved', actor: 'a', authorized: true, at: '2026-01-01T09:00:00Z' },\n      { event: 'architecture-reviewed', taskId: 'TASK-1', status: 'approved', actor: 'b', authorized: true, at: '2026-01-01T11:00:00Z' },\n    ],\n  });\n  assert.equal(find(result, 'skipped-architecture-review'), undefined);\n});\n\ntest('preserves a scope approval recorded before a later approval', () => {\n  const result = detectPlanningMistakes({\n    declaredScopePaths: ['src'],\n    commits: [commit('a', '2026-01-01T10:00:00Z', ['docs/approved.md'])],\n    events: [\n      { event: 'scope-approved', path: 'docs', actor: 'a', authorized: true, at: '2026-01-01T09:00:00Z' },\n      { event: 'scope-approved', path: 'docs', actor: 'b', authorized: true, at: '2026-01-01T11:00:00Z' },\n    ],\n  });\n  assert.equal(find(result, 'scope-creep'), undefined);\n});\n\ntest('does not treat a deleted required path as satisfaction evidence', () => {\n  const result = detectPlanningMistakes({\n    phase: 'review',\n    declaredScopePaths: ['src/**'],\n    commits: [\n      {\n        sha: 'delete',\n        timestamp: '2026-01-01T10:00:00Z',\n        files: [{ filename: 'src/required.ts', status: 'removed' }],\n      },\n    ],\n    requirements: [\n      { id: 'REQ-1', requiredPaths: ['src/required.ts'], satisfied: false },\n    ],\n  });\n  assert.equal(find(result, 'ignored-requirement').state, 'detected');\n});\n\ntest('evaluates the source path of a renamed file for scope creep', () => {\n  const result = detectPlanningMistakes({\n    declaredScopePaths: ['src/in-scope/**'],\n    commits: [\n      {\n        sha: 'rename',\n        timestamp: '2026-01-01T10:00:00Z',\n        files: [\n          {\n            filename: 'src/in-scope/moved.ts',\n            previousFilename: 'legacy/outside.ts',\n            status: 'renamed',\n          },\n        ],\n      },\n    ],\n  });\n  assert.ok(\n    result.findings.some(\n      (finding) =>\n        finding.type === 'scope-creep' &&\n        finding.evidence.some((item) => item.filename === 'legacy/outside.ts'),\n    ),\n  );\n});\n`;
  write(detectorPath, detector);

  const governancePath = 'tooling/planning-governance.test.mjs';
  let governance = read(governancePath);
  governance += `\n\ntest('governance honors an explicit planning exemption', () => {\n  const result = analyzePlanningMistakes({ phase: 'review' });\n  assert.deepEqual(\n    planningGovernanceErrors(\n      {\n        phase: 'review',\n        planningExempt: true,\n        planningIssues: [],\n        tasks: [],\n        declaredScopePaths: [],\n      },\n      result,\n    ),\n    [],\n  );\n});\n`;
  write(governancePath, governance);
}

try {
  transformPlanningHistory();
  transformDetector();
  transformAnalysis();
  transformGovernanceAndTemplate();
  transformTests();
} catch (error) {
  appendFileSync('.github/pr227-review-fixes.error.txt', `${error.stack ?? error}\n`);
  throw error;
}
