import {
  githubRequest,
  listAll,
  parseIssueNumbers,
  parsePullRequestField,
} from './engineering-learning-core.mjs';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function splitList(value) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValueBlock(body, blockName) {
  const expression = new RegExp(`<!-- ${blockName}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].map((match) =>
    Object.fromEntries(
      match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(':');
          return separator === -1
            ? [line, '']
            : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
        }),
    ),
  );
}

function extractSection(body, heading) {
  const lines = String(body ?? '').split('\n');
  const target = heading.trim().toLowerCase();
  const start = lines.findIndex((line) => {
    const match = line.match(/^#{2,3}\s+(.+)$/);
    return match !== null && match[1].trim().toLowerCase() === target;
  });
  if (start === -1) {
    return '';
  }
  const selected = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{2,3}\s+/.test(lines[index])) {
      break;
    }
    selected.push(lines[index]);
  }
  return selected.join('\n').trim();
}

function parseBoolean(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (['yes', 'true', 'required'].includes(normalized)) {
    return true;
  }
  if (['no', 'false', 'not-required', 'none'].includes(normalized)) {
    return false;
  }
  return null;
}

function parseTaskLine(line, issueNumber) {
  const normalized = line.replace(/^\s*[-*]\s+/, '').trim();
  if (!/^TASK-[A-Za-z0-9_-]+\b/i.test(normalized)) {
    return null;
  }
  const [idPart, ...parts] = normalized.split('|').map((part) => part.trim());
  const fields = Object.fromEntries(
    parts.map((part) => {
      const index = part.indexOf('=');
      return index === -1
        ? [part.toLowerCase(), '']
        : [part.slice(0, index).trim().toLowerCase(), part.slice(index + 1).trim()];
    }),
  );
  const estimate = Number(fields.estimate);
  return {
    id: idPart.split(/\s+/)[0].toUpperCase(),
    title: idPart.slice(idPart.split(/\s+/)[0].length).trim(),
    order: Number.isFinite(Number(fields.order)) ? Number(fields.order) : null,
    dependsOn:
      normalizeString(fields.depends).toLowerCase() === 'none' ? [] : splitList(fields.depends),
    estimateMinutes: Number.isFinite(estimate) && estimate > 0 ? estimate : null,
    scopePaths: splitList(fields.scope),
    architectureReviewRequired: parseBoolean(fields['architecture-review']),
    migrationRequired: parseBoolean(fields.migration),
    dependencyRequired: parseBoolean(fields.dependency),
    requirementIds: splitList(fields.requirements),
    issueNumber,
  };
}

function parseRequirements(body, issueNumber) {
  return extractSection(body, 'Requirements')
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(REQ-[A-Za-z0-9_-]+)\s*(.*)$/);
      if (match === null) {
        return null;
      }
      const pathMatch = match[3].match(/\bpaths?=([^;]+)$/i);
      return {
        id: match[2].toUpperCase(),
        text: match[3].replace(/\s+paths?=[^;]+$/i, '').trim(),
        satisfied: match[1].toLowerCase() === 'x',
        requiredPaths: pathMatch === null ? [] : splitList(pathMatch[1]),
        issueNumber,
      };
    })
    .filter(Boolean);
}

function parseHeadingScope(body) {
  const section =
    extractSection(body, 'Declared scope paths') || extractSection(body, 'Declared scope');
  return section
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, '')
        .replace(/^`|`$/g, '')
        .trim(),
    )
    .filter((line) => line.length > 0 && !line.startsWith('_'));
}

function eventFromMetadata(metadata, createdAt, issueNumber) {
  return {
    type: metadata.event,
    taskId: metadata['task-id'],
    requirementId: metadata['requirement-id'],
    findingType: metadata['finding-type'],
    at: metadata.at ?? createdAt,
    status: metadata.status,
    path: metadata.path ?? metadata.scope,
    estimateMinutes: metadata['estimate-minutes'] ?? metadata.estimate,
    reviewer: metadata.reviewer ?? metadata['approved-by'],
    reason: metadata.reason,
    issueNumber,
  };
}

export function parsePlanningIssue(issue, comments = []) {
  const body = issue.body ?? '';
  const issueNumber = Number(issue.number);
  const planMetadata = parseKeyValueBlock(body, 'newax-planning-plan').at(-1) ?? {};
  const taskSection = extractSection(body, 'Task sequence');
  const tasks = taskSection
    .split('\n')
    .map((line) => parseTaskLine(line, issueNumber))
    .filter(Boolean)
    .map((task, index) => ({ ...task, order: task.order ?? index + 1 }));
  if (parseBoolean(planMetadata['architecture-review-required']) === true) {
    const hasExplicitReviewTask = tasks.some((task) => task.architectureReviewRequired !== null);
    if (!hasExplicitReviewTask && tasks.length > 0) {
      tasks[0].architectureReviewRequired = true;
    }
  }

  const bodyEvents = parseKeyValueBlock(body, 'newax-planning-event').map((metadata) =>
    eventFromMetadata(metadata, issue.created_at ?? issue.createdAt, issueNumber),
  );
  const commentEvents = comments.flatMap((comment) =>
    parseKeyValueBlock(comment.body, 'newax-planning-event').map((metadata) =>
      eventFromMetadata(metadata, comment.created_at ?? comment.createdAt, issueNumber),
    ),
  );
  const declaredScopePaths = [
    ...splitList(planMetadata['declared-scope']),
    ...parseHeadingScope(body),
  ];

  return {
    planId: normalizeString(planMetadata['plan-id']) || `ISSUE-${issueNumber}`,
    issueNumber,
    estimatedMinutes: Number.isFinite(Number(planMetadata['estimated-minutes']))
      ? Number(planMetadata['estimated-minutes'])
      : null,
    architectureReviewRequired: parseBoolean(planMetadata['architecture-review-required']),
    declaredScopePaths: [...new Set(declaredScopePaths)],
    requirements: parseRequirements(body, issueNumber),
    tasks,
    events: [...bodyEvents, ...commentEvents],
  };
}

export function parsePlanningIssueNumbers(pullRequestBody) {
  const value = parsePullRequestField(pullRequestBody, '- Planning issues:');
  if (value !== null) {
    return parseIssueNumbers(value);
  }
  const matches = String(pullRequestBody ?? '').matchAll(/planning issue(?:s)?\s*[:#]?\s*#(\d+)/gi);
  return [...new Set([...matches].map((match) => Number(match[1])).filter(Number.isSafeInteger))];
}

function combinePlans(plans) {
  return {
    declaredScopePaths: [...new Set(plans.flatMap((plan) => plan.declaredScopePaths))],
    requirements: plans.flatMap((plan) => plan.requirements),
    tasks: plans.flatMap((plan) => plan.tasks),
    events: plans.flatMap((plan) => plan.events),
    planningIssues: plans.map((plan) => plan.issueNumber),
  };
}

async function requestAll(path, request) {
  if (request === githubRequest) {
    return listAll(path);
  }
  const response = await request(path);
  if (Array.isArray(response)) {
    return response;
  }
  for (const key of ['items', 'commits', 'files', 'comments']) {
    if (Array.isArray(response?.[key])) {
      return response[key];
    }
  }
  return [];
}

export async function collectPlanningHistory({ pullRequest, request = githubRequest }) {
  if (!Number.isSafeInteger(Number(pullRequest?.number))) {
    throw new TypeError('collectPlanningHistory requires a pull request number.');
  }
  const number = Number(pullRequest.number);
  const commitSummaries = await requestAll(`/pulls/${number}/commits`, request);
  const commits = [];
  for (let index = 0; index < commitSummaries.length; index += 1) {
    const summary = commitSummaries[index];
    const detail = await request(`/commits/${summary.sha}`);
    commits.push({
      sha: summary.sha,
      sequence: index,
      message: detail.commit?.message ?? summary.commit?.message ?? '',
      authoredAt: detail.commit?.author?.date ?? summary.commit?.author?.date ?? null,
      committedAt: detail.commit?.committer?.date ?? summary.commit?.committer?.date ?? null,
      files: (detail.files ?? []).map((file) => ({
        filename: file.filename,
        previousFilename: file.previous_filename,
        status: file.status,
        patch: file.patch ?? '',
      })),
    });
  }

  const issueNumbers = parsePlanningIssueNumbers(pullRequest.body ?? '');
  const plans = [];
  for (const issueNumber of issueNumbers) {
    const [issue, comments] = await Promise.all([
      request(`/issues/${issueNumber}`),
      requestAll(`/issues/${issueNumber}/comments`, request),
    ]);
    plans.push(parsePlanningIssue(issue, comments));
  }
  const combined = combinePlans(plans);
  return {
    phase: pullRequest.draft === true ? 'draft' : 'review',
    pullRequest: {
      number,
      draft: pullRequest.draft === true,
      headSha: pullRequest.head?.sha ?? pullRequest.head_sha ?? null,
      baseSha: pullRequest.base?.sha ?? pullRequest.base_sha ?? null,
    },
    commits,
    issues: plans.map((plan) => ({ number: plan.issueNumber, planId: plan.planId })),
    ...combined,
  };
}

export async function collectPlanningHistoryForPullRequest(number, request = githubRequest) {
  const pullRequest = await request(`/pulls/${Number(number)}`);
  return collectPlanningHistory({ pullRequest, request });
}
