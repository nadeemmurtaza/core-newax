import {
  githubRequest,
  listAll,
  loadCatalog,
  parseIssueNumbers,
  parseMetadata,
  parsePullRequestField,
} from './engineering-learning-core.mjs';
import { buildKnowledgeGraph } from './knowledge-graph.mjs';
import { parsePreventionPackReferences } from './prevention-history-parser.mjs';

function repositoryUrl(repository, path) {
  return `https://github.com/${repository}/${path}`;
}

function uniqueNumbers(values) {
  return [...new Set(values.filter(Number.isInteger))].sort((left, right) => left - right);
}

function linkedIssueNumbers(body) {
  const fields = [
    '- Planning issues:',
    '- Communication issues:',
    '- AI quality issues:',
    '- Prevention records:',
    '- Confidence records:',
    '- Learning issues:',
    '- Knowledge graph records:',
  ];
  return uniqueNumbers(
    fields.flatMap((field) => {
      const value = parsePullRequestField(body, field);
      return value === null ? [] : parseIssueNumbers(value);
    }),
  );
}

function markerBlocks(body, marker) {
  const expression = new RegExp(`<!-- ${marker}\\n([\\s\\S]*?)\\n-->`, 'g');
  return [...String(body ?? '').matchAll(expression)].map((match) =>
    Object.fromEntries(
      match[1]
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const index = line.indexOf(':');
          return index === -1
            ? [line.toLowerCase(), '']
            : [line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim()];
        }),
    ),
  );
}

function listField(body, label) {
  const match = String(body ?? '').match(new RegExp(`^-\\s*${label}:\\s*(.+)$`, 'im'));
  return match === null ? '' : match[1].replaceAll('`', '').trim();
}

function fullSha(value) {
  return (
    String(value ?? '')
      .match(/\b[0-9a-f]{40}\b/i)?.[0]
      ?.toLowerCase() ?? null
  );
}

function requirementRecords(issue) {
  const results = [];
  const seen = new Set();
  for (const match of String(issue.body ?? '').matchAll(/- \[[ xX]\]\s*(REQ-\d+)\s+(.+)/g)) {
    if (seen.has(match[1])) {
      continue;
    }
    seen.add(match[1]);
    results.push({ id: match[1], label: match[2].trim() });
  }
  return results;
}

function explicitLinks(textValues) {
  return textValues.flatMap((text) =>
    markerBlocks(text, 'newax-knowledge-link').map((metadata) => ({
      from: metadata.from,
      to: metadata.to,
      type: metadata.type,
      status: metadata.status || 'candidate',
      provenance: metadata.provenance || 'structured-knowledge-link',
      evidenceRefs: String(metadata['evidence-refs'] ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      occurredAt: metadata.at || null,
    })),
  );
}

function resolutionData(issue, comments) {
  const texts = [issue.body ?? '', ...comments.map((comment) => comment.body ?? '')];
  const preventionEvents = texts.flatMap((text) => markerBlocks(text, 'newax-prevention-event'));
  const latest = preventionEvents.at(-1) ?? {};
  return {
    fixCommit: fullSha(latest['fix-commit']) || fullSha(listField(issue.body, 'Fix commit')),
    resolutionStatus: latest['resolution-status'] || listField(issue.body, 'Resolution status'),
    verificationRefs: [
      ...String(latest['verification-refs'] ?? '').split(','),
      listField(issue.body, 'Successful verification'),
    ]
      .map((value) => value.trim())
      .filter(Boolean),
    preventionControl: latest['prevention-control'] || listField(issue.body, 'Prevention control'),
    ledgerEntry: latest['ledger-entry'] || listField(issue.body, 'Ledger entry'),
  };
}

export async function collectKnowledgeGraphForPullRequest(prNumber, options = {}) {
  const request = options.request ?? githubRequest;
  const list = options.listAll ?? listAll;
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error('GITHUB_REPOSITORY is required for knowledge graph collection.');
  }
  const pr = await request(`/pulls/${prNumber}`, options);
  const [commits, reviews, reviewComments, issueComments, runs] = await Promise.all([
    list(`/pulls/${prNumber}/commits`, options),
    list(`/pulls/${prNumber}/reviews`, options),
    list(`/pulls/${prNumber}/comments`, options),
    list(`/issues/${prNumber}/comments`, options),
    list(`/actions/runs?event=pull_request&head_sha=${encodeURIComponent(pr.head.sha)}`, {
      ...options,
      collectionKey: 'workflow_runs',
    }),
  ]);
  const issueNumbers = linkedIssueNumbers(pr.body ?? '');
  const linked = [];
  for (const issueNumber of issueNumbers) {
    const [issue, comments] = await Promise.all([
      request(`/issues/${issueNumber}`, options),
      list(`/issues/${issueNumber}/comments`, options),
    ]);
    linked.push({ issue, comments });
  }
  const jobsByRun = new Map();
  for (const run of runs) {
    jobsByRun.set(
      Number(run.id),
      await list(`/actions/runs/${run.id}/jobs`, { ...options, collectionKey: 'jobs' }),
    );
  }

  const nodes = [];
  const edges = [];
  const prNodeId = `pr:${pr.number}`;
  nodes.push({
    id: prNodeId,
    kind: 'pull-request',
    label: `PR #${pr.number}: ${pr.title}`,
    status: pr.merged ? 'merged' : pr.draft ? 'draft' : pr.state,
    occurredAt: pr.created_at,
    url: pr.html_url,
    evidenceRefs: [`github:pull-request:${pr.number}`],
    metadata: { base: pr.base.ref, head: pr.head.ref, headSha: pr.head.sha },
  });

  for (const commit of commits) {
    const sha = commit.sha.toLowerCase();
    const id = `commit:${sha}`;
    nodes.push({
      id,
      kind: 'commit',
      label: `${sha.slice(0, 12)} ${commit.commit?.message?.split('\n')[0] ?? ''}`.trim(),
      status: 'observed',
      occurredAt: commit.commit?.committer?.date ?? commit.commit?.author?.date,
      url: commit.html_url ?? repositoryUrl(repository, `commit/${sha}`),
      evidenceRefs: [`github:pr:${pr.number}:commit:${sha}`],
      metadata: { sha },
    });
    edges.push({
      from: id,
      to: prNodeId,
      type: 'included-in',
      status: 'verified',
      provenance: `GitHub pull request commit membership for #${pr.number}`,
      evidenceRefs: [`github:pr:${pr.number}:commits`],
    });
  }

  const allReviews = [
    ...reviews.map((review) => ({ ...review, sourceKind: 'review-submission' })),
    ...reviewComments.map((comment) => ({ ...comment, sourceKind: 'inline-review-comment' })),
  ];
  for (const review of allReviews) {
    const reviewId = review.id ?? review.node_id;
    const id = `review:${review.sourceKind}:${reviewId}`;
    nodes.push({
      id,
      kind: 'review',
      label: `${review.sourceKind} ${reviewId}`,
      status: String(review.state ?? 'commented').toLowerCase(),
      occurredAt: review.submitted_at ?? review.created_at,
      url: review.html_url ?? `${pr.html_url}#discussion_r${reviewId}`,
      evidenceRefs: [`github:${review.sourceKind}:${reviewId}`],
      metadata: { author: review.user?.login ?? null },
    });
    edges.push({
      from: prNodeId,
      to: id,
      type: 'reviewed-by',
      status: 'verified',
      provenance: `GitHub ${review.sourceKind} attached to PR #${pr.number}`,
      evidenceRefs: [`github:${review.sourceKind}:${reviewId}`],
    });
  }

  const commitIds = new Set(commits.map((commit) => `commit:${commit.sha.toLowerCase()}`));
  for (const run of runs) {
    const id = `ci-run:${run.id}`;
    const jobs = jobsByRun.get(Number(run.id)) ?? [];
    const status = run.conclusion ?? run.status ?? 'unknown';
    nodes.push({
      id,
      kind: 'ci-run',
      label: `${run.name ?? 'Workflow'} #${run.run_number ?? run.id}`,
      status,
      occurredAt: run.created_at ?? run.run_started_at,
      url: run.html_url ?? repositoryUrl(repository, `actions/runs/${run.id}`),
      evidenceRefs: [`github:workflow-run:${run.id}`],
      metadata: {
        headSha: run.head_sha,
        jobs: jobs.map((job) => ({ id: job.id, name: job.name, conclusion: job.conclusion })),
      },
    });
    edges.push({
      from: prNodeId,
      to: id,
      type: 'validated-by',
      status: 'verified',
      provenance: `GitHub workflow run associated with PR head ${pr.head.sha}`,
      evidenceRefs: [`github:workflow-run:${run.id}:head-sha:${run.head_sha}`],
    });
    const headCommitId = `commit:${String(run.head_sha ?? '').toLowerCase()}`;
    if (commitIds.has(headCommitId)) {
      edges.push({
        from: headCommitId,
        to: id,
        type: 'validated-by',
        status: 'verified',
        provenance: `Workflow run ${run.id} exact head SHA`,
        evidenceRefs: [`github:workflow-run:${run.id}:head-sha:${run.head_sha}`],
      });
    }
  }

  const catalog = options.catalog ?? loadCatalog();
  const catalogById = new Map(catalog.rootCauses.map((entry) => [entry.id, entry]));
  for (const { issue, comments } of linked) {
    const issueUrl = issue.html_url ?? repositoryUrl(repository, `issues/${issue.number}`);
    const metadata = parseMetadata(issue.body ?? '');
    const requirements = requirementRecords(issue);
    for (const requirement of requirements) {
      nodes.push({
        id: `requirement:${issue.number}:${requirement.id}`,
        kind: 'requirement',
        label: `${requirement.id} ${requirement.label}`,
        status: new RegExp(`- \\[xX\\]\\s*${requirement.id}\\b`).test(issue.body ?? '')
          ? 'satisfied'
          : 'declared',
        occurredAt: issue.created_at,
        url: issueUrl,
        evidenceRefs: [`github:issue:${issue.number}:${requirement.id}`],
        metadata: { issueNumber: issue.number, requirementId: requirement.id },
      });
    }

    const rootCauseId = metadata['root-cause-id'];
    if (rootCauseId) {
      const bugId = `bug:issue:${issue.number}`;
      const rootId = `root-cause:${rootCauseId}`;
      const root = catalogById.get(rootCauseId);
      nodes.push({
        id: bugId,
        kind: 'bug',
        label: `Issue #${issue.number}: ${issue.title}`,
        status: issue.state,
        occurredAt: issue.created_at,
        url: issueUrl,
        evidenceRefs: [
          `github:issue:${issue.number}`,
          `fingerprint:${metadata.fingerprint ?? 'none'}`,
        ],
        metadata: { issueNumber: issue.number, fingerprint: metadata.fingerprint ?? null },
      });
      nodes.push({
        id: rootId,
        kind: 'root-cause',
        label: root?.rootCause ?? rootCauseId,
        status: metadata['root-cause-status'] ?? 'candidate',
        sourceRef: `catalog:${rootCauseId}`,
        evidenceRefs: [
          `github:issue:${issue.number}:root-cause`,
          ...(root?.signatures ?? []).map((signature) => `signature:${signature}`),
        ],
        metadata: { rootCauseId, ledgerEntry: root?.ledgerEntry ?? null },
      });
      edges.push({
        from: bugId,
        to: rootId,
        type: 'classified-as',
        status: ['confirmed', 'machine-supported'].includes(metadata['root-cause-status'])
          ? 'verified'
          : 'candidate',
        provenance: `Structured engineering event in issue #${issue.number}`,
        evidenceRefs: [`github:issue:${issue.number}:root-cause-status`],
      });
      const runId = Number(metadata['workflow-run-id']);
      if (Number.isInteger(runId) && runs.some((run) => Number(run.id) === runId)) {
        edges.push({
          from: `ci-run:${runId}`,
          to: bugId,
          type: 'revealed',
          status: 'verified',
          provenance: `Issue #${issue.number} structured workflow-run-id`,
          evidenceRefs: [`github:issue:${issue.number}:workflow-run-id:${runId}`],
        });
      }
      const resolution = resolutionData(issue, comments);
      if (resolution.fixCommit) {
        const fixId = `fix:${resolution.fixCommit}`;
        nodes.push({
          id: fixId,
          kind: 'fix',
          label: `Fix ${resolution.fixCommit.slice(0, 12)}`,
          status: resolution.resolutionStatus || 'recorded',
          url: repositoryUrl(repository, `commit/${resolution.fixCommit}`),
          evidenceRefs: [`github:issue:${issue.number}:fix-commit`],
          metadata: { sha: resolution.fixCommit },
        });
        edges.push({
          from: rootId,
          to: fixId,
          type: 'resolved-by',
          status: ['resolved', 'verified'].includes(resolution.resolutionStatus.toLowerCase())
            ? 'verified'
            : 'candidate',
          provenance: `Issue #${issue.number} resolution record`,
          evidenceRefs: [`github:issue:${issue.number}:resolution-status`],
        });
        for (const [index, reference] of resolution.verificationRefs.entries()) {
          const verificationId = `verification:issue:${issue.number}:${index + 1}`;
          const exact = /(?:workflow|run).*(?:job).*(?:step)/i.test(reference);
          nodes.push({
            id: verificationId,
            kind: 'verification',
            label: reference,
            status: exact ? 'verified' : 'recorded',
            url: issueUrl,
            evidenceRefs: [`github:issue:${issue.number}:verification:${index + 1}`],
            metadata: { exactRunJobStep: exact, issueNumber: issue.number },
          });
          edges.push({
            from: fixId,
            to: verificationId,
            type: 'verified-by',
            status: exact ? 'verified' : 'candidate',
            provenance: `Issue #${issue.number} verification record`,
            evidenceRefs: [`github:issue:${issue.number}:verification:${index + 1}`],
          });
        }
      }
      const ledgerEntry = resolution.ledgerEntry || root?.ledgerEntry;
      if (ledgerEntry) {
        const lessonId = `lesson:${ledgerEntry}`;
        nodes.push({
          id: lessonId,
          kind: 'lesson',
          label: ledgerEntry,
          status: 'recorded',
          sourceRef: `ledger:${ledgerEntry}`,
          evidenceRefs: [`github:issue:${issue.number}:ledger-entry`],
          metadata: { ledgerEntry },
        });
        const verificationNodes = nodes.filter(
          (node) => node.kind === 'verification' && node.metadata?.issueNumber === issue.number,
        );
        if (verificationNodes.length === 0) {
          edges.push({
            from: rootId,
            to: lessonId,
            type: 'captured-as',
            status: 'candidate',
            provenance: `Issue #${issue.number} ledger reference without exact verification-to-lesson link`,
            evidenceRefs: [`github:issue:${issue.number}:ledger-entry`],
          });
        } else {
          for (const verificationNode of verificationNodes) {
            edges.push({
              from: verificationNode.id,
              to: lessonId,
              type: 'captured-as',
              status:
                verificationNode.status === 'verified' && issue.state === 'closed'
                  ? 'verified'
                  : 'candidate',
              provenance: `Issue #${issue.number} verification and ledger record`,
              evidenceRefs: [
                `github:issue:${issue.number}:ledger-entry`,
                ...verificationNode.evidenceRefs,
              ],
            });
          }
        }
        if (resolution.preventionControl) {
          const ruleId = `rule:issue:${issue.number}`;
          nodes.push({
            id: ruleId,
            kind: 'rule',
            label: resolution.preventionControl,
            status: 'recorded',
            url: issueUrl,
            evidenceRefs: [`github:issue:${issue.number}:prevention-control`],
          });
          edges.push({
            from: lessonId,
            to: ruleId,
            type: 'materialized-as',
            status: issue.state === 'closed' ? 'verified' : 'candidate',
            provenance: `Issue #${issue.number} prevention control`,
            evidenceRefs: [`github:issue:${issue.number}:prevention-control`],
          });
          for (const [index, path] of parsePreventionPackReferences(issue.body ?? '').entries()) {
            const preventionId = `prevention:${rootCauseId}:${index + 1}`;
            nodes.push({
              id: preventionId,
              kind: 'prevention',
              label: path,
              status: 'enforced',
              url: repositoryUrl(repository, `blob/${pr.head.sha}/${path}`),
              evidenceRefs: [`github:issue:${issue.number}:prevention-pack`],
              metadata: { path },
            });
            edges.push({
              from: ruleId,
              to: preventionId,
              type: 'enforced-by',
              status: issue.state === 'closed' ? 'verified' : 'candidate',
              provenance: `Issue #${issue.number} prevention pack reference`,
              evidenceRefs: [`github:issue:${issue.number}:prevention-pack`],
            });
          }
        }
      }
    }
  }

  const allTexts = [
    pr.body ?? '',
    ...issueComments.map((comment) => comment.body ?? ''),
    ...linked.flatMap(({ issue, comments }) => [
      issue.body ?? '',
      ...comments.map((comment) => comment.body ?? ''),
    ]),
  ];
  edges.push(...explicitLinks(allTexts));
  return buildKnowledgeGraph(nodes, edges, {
    source: {
      type: 'github-pull-request',
      repository,
      prNumber: Number(prNumber),
      headSha: pr.head.sha,
    },
  });
}
