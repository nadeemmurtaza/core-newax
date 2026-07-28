import { readFileSync } from 'node:fs';

import { githubRequest } from './engineering-learning-core.mjs';
import { renderPreventionFiles } from './prevention-control-renderer.mjs';
import { buildPreventionRegistry } from './prevention-engine.mjs';
import { controlTargetPath } from './prevention-engine-support.mjs';
import { collectPreventionHistory } from './prevention-history-github.mjs';

function decodeContent(response) {
  if (typeof response?.content !== 'string') {
    return null;
  }
  return Buffer.from(response.content.replace(/\n/g, ''), response.encoding ?? 'base64').toString(
    'utf8',
  );
}

async function readRepositoryFile(path, ref, request = githubRequest) {
  try {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const response = await request(`/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`);
    return decodeContent(response);
  } catch (error) {
    if (String(error).includes('(404 ')) {
      return null;
    }
    throw error;
  }
}

export async function loadExistingPreventionPacks(history, request = githubRequest) {
  const rootCauseIds = [
    ...new Set((history.mistakes ?? []).map((mistake) => mistake.rootCauseId).filter(Boolean)),
  ];
  const packs = [];
  for (const rootCauseId of rootCauseIds) {
    const path = controlTargetPath(rootCauseId, 'ci-check');
    const content = await readRepositoryFile(path, history.pullRequest.baseSha, request);
    if (content === null) {
      continue;
    }
    const parsed = JSON.parse(content);
    if (parsed.pack?.rootCauseId === rootCauseId) {
      packs.push(parsed.pack);
    }
  }
  return packs;
}

export async function loadHeadPreventionFiles(packs, headSha, request = githubRequest) {
  const files = new Map();
  for (const pack of packs) {
    for (const file of renderPreventionFiles(pack)) {
      files.set(file.path, await readRepositoryFile(file.path, headSha, request));
    }
  }
  return files;
}

export function preventionGovernanceErrors(history, registry, headFiles = new Map()) {
  const errors = [];
  for (const result of registry.results) {
    if (result.status !== 'ready') {
      errors.push(
        `${result.mistake.rootCauseId || result.mistake.id}: missing ${result.missingEvidence.join(', ')}.`,
      );
    }
  }
  for (const pack of registry.packs) {
    for (const expected of renderPreventionFiles(pack)) {
      const actual = headFiles.get(expected.path);
      if (actual === null || actual === undefined) {
        errors.push(`Missing generated prevention control: ${expected.path}.`);
      } else if (actual !== expected.content) {
        errors.push(`Stale generated prevention control: ${expected.path}.`);
      }
    }
  }
  if (
    history.phase === 'review' &&
    (history.mistakes ?? []).length > 0 &&
    registry.packs.length === 0
  ) {
    errors.push(
      'A review-ready pull request with resolved mistakes requires a prevention control pack.',
    );
  }
  return errors;
}

async function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath === undefined || eventPath.length === 0) {
    throw new Error('GITHUB_EVENT_PATH is unavailable.');
  }
  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  if (event.pull_request === undefined) {
    throw new Error('The pull_request payload is unavailable.');
  }
  const history = await collectPreventionHistory({ pullRequest: event.pull_request });
  const existingPacks = await loadExistingPreventionPacks(history);
  const registry = buildPreventionRegistry(
    history.mistakes,
    existingPacks,
    history.controlOptions ?? {},
  );
  const headFiles = await loadHeadPreventionFiles(registry.packs, history.pullRequest.headSha);
  const errors = preventionGovernanceErrors(history, registry, headFiles);
  console.log(
    JSON.stringify(
      {
        pullRequest: history.pullRequest,
        preventionIssues: history.preventionIssues,
        mistakeCount: history.mistakes.length,
        packs: registry.packs.map((pack) => ({
          id: pack.id,
          rootCauseId: pack.rootCauseId,
          revision: pack.revision,
          controls: pack.controls.map((control) => ({
            id: control.id,
            type: control.type,
            state: control.state,
            targetPath: control.targetPath,
          })),
        })),
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length > 0) {
    console.error('Prevention governance failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
