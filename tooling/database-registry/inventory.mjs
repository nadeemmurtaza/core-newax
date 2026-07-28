import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import {
  detectGlobalPrefix,
  normalizePath,
  parseControllersFromFiles,
  parseMigrations,
  parseModuleRegistry,
  parsePrismaSchema,
  sha256,
  walkFiles,
} from './parsers.mjs';

function collectDeferredItems(modules) {
  const keywords = /\b(deferred|remain(?:s|ing)?|not included|not supported|disabled|future)\b/i;
  const items = [];
  for (const registryModule of modules) {
    for (const sentence of registryModule.compatibilityNotes.split(/(?<=[.!?])\s+/)) {
      if (keywords.test(sentence)) {
        items.push({
          moduleKey: registryModule.key,
          moduleName: registryModule.name,
          text: sentence.trim(),
        });
      }
    }
  }
  return items.sort((left, right) => left.moduleName.localeCompare(right.moduleName));
}

function assignModelOwnership(models, modules) {
  const ownershipByTable = new Map();
  for (const registryModule of modules) {
    for (const table of registryModule.databaseOwnership) {
      ownershipByTable.set(table, {
        moduleKey: registryModule.key,
        moduleName: registryModule.name,
        moduleLayer: registryModule.layer,
        governanceStatus: registryModule.governanceStatus,
      });
    }
  }

  return models.map((model) => ({
    ...model,
    owner: ownershipByTable.get(model.tableName) ?? {
      moduleKey: 'unassigned',
      moduleName: 'Unassigned registry ownership',
      moduleLayer: 'unassigned',
      governanceStatus: 'unassigned',
    },
  }));
}

function readGitValue(root, args, fallback) {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

function resolveSourceMetadata(root, mode) {
  if (mode === 'snapshot') {
    return {
      mode,
      repository: process.env.GITHUB_REPOSITORY ?? 'Newax-Technologies/core-newax',
      branch: 'repository-snapshot',
      sha: 'repository-snapshot',
      commitDate: null,
      generatedAt: null,
      workflowRunUrl: null,
    };
  }

  const repository = process.env.GITHUB_REPOSITORY ?? 'Newax-Technologies/core-newax';
  const sha = process.env.GITHUB_SHA ?? readGitValue(root, ['rev-parse', 'HEAD'], 'unknown');
  const branch =
    process.env.GITHUB_REF_NAME ?? readGitValue(root, ['branch', '--show-current'], 'unknown');
  const commitDate = readGitValue(root, ['show', '-s', '--format=%cI', sha], null);
  const runId = process.env.GITHUB_RUN_ID;

  return {
    mode,
    repository,
    branch,
    sha,
    commitDate,
    generatedAt: new Date().toISOString(),
    workflowRunUrl: runId ? `https://github.com/${repository}/actions/runs/${runId}` : null,
  };
}

async function fetchOpenPullRequests(source) {
  const token = process.env.GITHUB_TOKEN;
  if (!token || !source.repository.includes('/')) {
    return {
      status: 'unavailable',
      reason: 'GitHub token or repository context is unavailable.',
      items: [],
    };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${source.repository}/pulls?state=open&per_page=100&sort=updated&direction=desc`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (!response.ok) {
      return {
        status: 'unavailable',
        reason: `GitHub API returned ${response.status}.`,
        items: [],
      };
    }
    const payload = await response.json();
    return {
      status: 'available',
      reason: null,
      items: payload.map((pullRequest) => ({
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url,
        draft: pullRequest.draft,
        base: pullRequest.base.ref,
        head: pullRequest.head.ref,
        headSha: pullRequest.head.sha,
        updatedAt: pullRequest.updated_at,
      })),
    };
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Unknown GitHub API failure.',
      items: [],
    };
  }
}

function readRepositoryInputs(root) {
  const schemaPath = join(root, 'apps/api/prisma/schema.prisma');
  const registryPath = join(root, 'registry/module-registry.json');
  const mainPath = join(root, 'apps/api/src/main.ts');
  if (!existsSync(schemaPath)) {
    throw new Error(`Required Prisma schema was not found: ${schemaPath}`);
  }
  if (!existsSync(registryPath)) {
    throw new Error(`Required Module Registry was not found: ${registryPath}`);
  }

  const schemaSource = readFileSync(schemaPath, 'utf8');
  const registrySource = readFileSync(registryPath, 'utf8');
  const mainSource = existsSync(mainPath) ? readFileSync(mainPath, 'utf8') : '';
  const controllerFiles = walkFiles(join(root, 'apps/api/src'), (path) =>
    path.endsWith('.controller.ts'),
  ).map((path) => ({
    path: normalizePath(relative(root, path)),
    content: readFileSync(path, 'utf8'),
  }));
  const migrationRoot = join(root, 'apps/api/prisma/migrations');
  const migrationEntries = existsSync(migrationRoot)
    ? readdirSync(migrationRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const migrationPath = join(migrationRoot, entry.name, 'migration.sql');
          return existsSync(migrationPath)
            ? {
                id: entry.name,
                path: normalizePath(relative(root, migrationPath)),
                content: readFileSync(migrationPath, 'utf8'),
              }
            : null;
        })
        .filter(Boolean)
    : [];

  const trackedInputs = [
    { path: normalizePath(relative(root, schemaPath)), content: schemaSource },
    {
      path: normalizePath(relative(root, registryPath)),
      content: registrySource,
    },
    ...controllerFiles,
    ...migrationEntries.map((entry) => ({
      path: entry.path,
      content: entry.content,
    })),
  ].sort((left, right) => left.path.localeCompare(right.path));

  return {
    schemaSource,
    registrySource,
    mainSource,
    controllerFiles,
    migrationEntries,
    inputHash: sha256(
      trackedInputs.map((input) => `${input.path}\n${input.content}`).join('\n\0\n'),
    ),
    inputFiles: trackedInputs.map((input) => input.path),
  };
}

export async function buildInventory({ root = process.cwd(), mode = 'snapshot' } = {}) {
  const repositoryRoot = resolve(root);
  const inputs = readRepositoryInputs(repositoryRoot);
  const prisma = parsePrismaSchema(inputs.schemaSource);
  const registry = parseModuleRegistry(inputs.registrySource);
  const globalPrefix = detectGlobalPrefix(inputs.mainSource);
  const endpoints = parseControllersFromFiles(inputs.controllerFiles, globalPrefix);
  const migrations = parseMigrations(inputs.migrationEntries);
  const source = resolveSourceMetadata(repositoryRoot, mode);
  const pullRequests =
    mode === 'publish'
      ? await fetchOpenPullRequests(source)
      : { status: 'not_requested', reason: null, items: [] };
  const models = assignModelOwnership(prisma.models, registry.modules);
  const plannedModules = registry.modules.filter((module) => module.governanceStatus === 'planned');
  const implementedModules = registry.modules.filter((module) =>
    ['active', 'draft'].includes(module.governanceStatus),
  );

  return {
    formatVersion: '1.0.0',
    title: 'NEWAX Core Database Registry',
    category: 'The Business Infrastructure Company',
    source: {
      ...source,
      inputHash: inputs.inputHash,
      inputFileCount: inputs.inputFiles.length,
      inputFiles: inputs.inputFiles,
    },
    truthModel: {
      repositoryState:
        'Models, migrations and endpoints are discovered from the exact checked-out repository state.',
      governanceState:
        'Module Registry statuses describe governance maturity and do not by themselves prove production approval.',
      deploymentState:
        'Migration files are source definitions. This map does not claim that a production database has applied them.',
      pullRequestState:
        'Open pull requests are fetched only in publish mode and remain separate from merged repository state.',
    },
    registry,
    database: {
      provider: 'PostgreSQL',
      schemaPath: 'apps/api/prisma/schema.prisma',
      modelCount: models.length,
      relationCount: prisma.relations.length,
      models,
      relations: prisma.relations,
      migrations,
    },
    api: {
      globalPrefix,
      endpointCount: endpoints.length,
      endpoints,
    },
    delivery: {
      implementedModuleCount: implementedModules.length,
      plannedModuleCount: plannedModules.length,
      implementedModules: implementedModules.map((module) => module.key),
      plannedModules: plannedModules.map((module) => module.key),
      deferredItems: collectDeferredItems(registry.modules),
      openPullRequests: pullRequests,
    },
  };
}

export function serializeInventory(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}
