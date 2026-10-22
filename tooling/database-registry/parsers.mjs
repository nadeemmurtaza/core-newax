import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

const SCALAR_TYPES = new Set([
  'BigInt',
  'Boolean',
  'Bytes',
  'DateTime',
  'Decimal',
  'Float',
  'Int',
  'Json',
  'String',
]);
const HTTP_METHODS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete']);
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.pnpm-store',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'out',
  'test-results',
]);

export function normalizePath(path) {
  return path.split(sep).join('/');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function titleFromSlug(value) {
  return value
    .replace(/^\d+_?/, '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function stripTypeModifiers(type) {
  return type.replace(/\[\]$/, '').replace(/\?$/, '');
}

function joinRoute(...segments) {
  const parts = segments
    .flatMap((part) => String(part ?? '').split('/'))
    .map((part) => part.trim())
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

function routeArgument(value) {
  const match = value.match(/^\s*(['"`])([^'"`]*)\1\s*$/);
  return match?.[2] ?? '';
}

export function walkFiles(root, predicate) {
  if (!existsSync(root)) {
    return [];
  }

  const output = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && predicate(fullPath)) {
        output.push(fullPath);
      }
    }
  };

  visit(root);
  return output.sort((left, right) => left.localeCompare(right));
}

export function parsePrismaSchema(source) {
  const modelBlocks = [];
  const blockPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match;

  while ((match = blockPattern.exec(source)) !== null) {
    modelBlocks.push({ name: match[1], body: match[2] });
  }

  const modelNames = new Set(modelBlocks.map((model) => model.name));
  const models = modelBlocks.map(({ name, body }) => {
    const tableName = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name;
    const fields = [];
    const indexes = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//')) {
        continue;
      }
      if (line.startsWith('@@')) {
        indexes.push(line);
        continue;
      }
      if (line.startsWith('@')) {
        continue;
      }

      const fieldMatch = line.match(/^(\w+)\s+([A-Za-z][A-Za-z0-9_]*(?:\[\])?\??)(?:\s+(.+))?$/);
      if (!fieldMatch) {
        continue;
      }

      const [, fieldName, type, attributes = ''] = fieldMatch;
      const baseType = stripTypeModifiers(type);
      const columnName = attributes.match(/@map\("([^"]+)"\)/)?.[1] ?? fieldName;
      const relationName = attributes.match(/@relation\("([^"]+)"/)?.[1] ?? null;
      fields.push({
        name: fieldName,
        columnName,
        type,
        baseType,
        optional: type.endsWith('?'),
        list: type.endsWith('[]'),
        scalar: SCALAR_TYPES.has(baseType),
        relation: modelNames.has(baseType),
        relationName,
        id: /(?:^|\s)@id(?:\s|$|\()/.test(attributes),
        unique: /(?:^|\s)@unique(?:\s|$|\()/.test(attributes),
      });
    }

    return {
      name,
      tableName,
      fields,
      indexes,
      scalarFieldCount: fields.filter((field) => field.scalar).length,
      relationFieldCount: fields.filter((field) => field.relation).length,
    };
  });

  const relationIndexes = new Map();
  const relations = [];
  for (const model of models) {
    for (const field of model.fields.filter((candidate) => candidate.relation)) {
      const pair = [model.name, field.baseType].sort().join('::');
      const key = field.relationName ? `${pair}::${field.relationName}` : pair;
      const relation = {
        source: model.name,
        target: field.baseType,
        field: field.name,
        relationName: field.relationName,
        optional: field.optional,
        list: field.list,
      };
      const existingIndex = relationIndexes.get(key);
      if (existingIndex !== undefined) {
        if (relations[existingIndex].list && !relation.list) {
          relations[existingIndex] = relation;
        }
        continue;
      }
      relationIndexes.set(key, relations.length);
      relations.push(relation);
    }
  }

  models.sort((left, right) => left.tableName.localeCompare(right.tableName));
  relations.sort((left, right) => {
    const sourceOrder = left.source.localeCompare(right.source);
    if (sourceOrder !== 0) {
      return sourceOrder;
    }
    return left.target.localeCompare(right.target);
  });

  return { models, relations };
}

export function parseModuleRegistry(source) {
  const registry = JSON.parse(source);
  const modules = (registry.modules ?? []).map((module) => ({
    name: module.module_name,
    key: module.module_key,
    layer: module.module_layer,
    version: module.module_version,
    governanceStatus: module.module_status,
    owner: module.module_owner,
    description: module.description,
    dependencies: (module.dependencies ?? []).map((dependency) =>
      typeof dependency === 'string'
        ? { key: dependency, version: null }
        : { key: dependency.module_key, version: dependency.version ?? null },
    ),
    requiredPermissions: module.required_permissions ?? [],
    exposedEvents: module.exposed_events ?? [],
    consumedEvents: module.consumed_events ?? [],
    configurationOptions: module.configuration_options ?? [],
    databaseOwnership: module.database_ownership ?? [],
    tenantScope: module.tenant_scope ?? 'unspecified',
    documentationPath: module.documentation_path ?? null,
    changelogPath: module.changelog_path ?? null,
    compatibilityNotes: module.compatibility_notes ?? '',
    deliveryState:
      module.module_status === 'active'
        ? 'active'
        : module.module_status === 'draft'
          ? 'implemented_draft'
          : module.module_status === 'planned'
            ? 'planned'
            : module.module_status,
  }));

  modules.sort((left, right) => {
    const layerOrder = left.layer.localeCompare(right.layer);
    if (layerOrder !== 0) {
      return layerOrder;
    }
    return left.name.localeCompare(right.name);
  });

  return {
    name: registry.registry_name,
    key: registry.registry_key,
    version: registry.registry_version,
    status: registry.registry_status,
    lastUpdated: registry.last_updated,
    owner: registry.owner,
    purpose: registry.purpose,
    governance: registry.governance ?? {},
    modules,
  };
}

export function detectGlobalPrefix(source) {
  const literalMatch = source.match(/\.setGlobalPrefix\(\s*(['"`])([^'"`]*)\1\s*\)/);
  if (literalMatch) {
    return literalMatch[2];
  }

  const identifierMatch = source.match(/\.setGlobalPrefix\(\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/);
  if (!identifierMatch) {
    return '';
  }

  const declarationPattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(['"`])([^'"`]*)\2/g;
  for (const declaration of source.matchAll(declarationPattern)) {
    if (declaration[1] === identifierMatch[1]) {
      return declaration[3];
    }
  }
  return '';
}

export function parseControllersFromFiles(files, globalPrefix = '') {
  const endpoints = [];

  for (const file of files) {
    const controllerMatch = file.content.match(/@Controller\(\s*(['"`])([^'"`]*)\1\s*\)/);
    if (!controllerMatch) {
      continue;
    }

    const controllerPrefix = controllerMatch[2];
    const classDeclarationIndex = file.content.indexOf('export class', controllerMatch.index);
    const classDecoratorBlock =
      classDeclarationIndex === -1
        ? ''
        : file.content.slice(
            controllerMatch.index + controllerMatch[0].length,
            classDeclarationIndex,
          );
    const classContext =
      classDecoratorBlock.includes('@PublicEndpoint') ||
      classDecoratorBlock.includes('@PublicAuthenticationEndpoint')
        ? 'public'
        : 'unspecified';
    const routePattern =
      /@(Get|Post|Put|Patch|Delete)\(([^)]*)\)([\s\S]*?)\n\s*(?:public\s+|protected\s+|private\s+)?(?:async\s+)?([A-Za-z0-9_]+)\s*\(/g;
    let routeMatch;
    while ((routeMatch = routePattern.exec(file.content)) !== null) {
      const [, decorator, rawPath, decoratorBlock, handler] = routeMatch;
      if (!HTTP_METHODS.has(decorator)) {
        continue;
      }
      const suffix = routeArgument(rawPath);
      const permissions = [...decoratorBlock.matchAll(/@RequirePermissions\(([^)]*)\)/g)]
        .flatMap((permissionMatch) => permissionMatch[1].split(','))
        .map((permission) => permission.trim())
        .filter(Boolean);
      const httpCode = decoratorBlock.match(/@HttpCode\((\d+)\)/)?.[1];
      const context = decoratorBlock.includes('@OrganizationContextEndpoint')
        ? 'organization'
        : decoratorBlock.includes('@AccountContextEndpoint')
          ? 'account'
          : decoratorBlock.includes('@PublicEndpoint') ||
              decoratorBlock.includes('@PublicAuthenticationEndpoint')
            ? 'public'
            : classContext;

      endpoints.push({
        method: decorator.toUpperCase(),
        path: joinRoute(globalPrefix, controllerPrefix, suffix),
        controller: controllerMatch[0],
        handler,
        context,
        permissions,
        successCode: httpCode ? Number(httpCode) : decorator === 'Post' ? 201 : 200,
        sourcePath: file.path,
      });
    }
  }

  endpoints.sort((left, right) => {
    const pathOrder = left.path.localeCompare(right.path);
    if (pathOrder !== 0) {
      return pathOrder;
    }
    return left.method.localeCompare(right.method);
  });
  return endpoints;
}

export function parseMigrations(entries) {
  return entries
    .map((entry) => {
      const tables = [
        ...entry.content.matchAll(
          /\b(?:TABLE|REFERENCES|UPDATE|FROM|INTO|ON)\s+(?:IF\s+EXISTS\s+)?["`](core_[a-z0-9_]+)["`]/gi,
        ),
      ].map((match) => match[1]);
      const uniqueTables = [...new Set(tables)].sort();
      const operationCounts = {
        createTable: (entry.content.match(/\bCREATE\s+TABLE\b/gi) ?? []).length,
        alterTable: (entry.content.match(/\bALTER\s+TABLE\b/gi) ?? []).length,
        createIndex: (entry.content.match(/\bCREATE(?:\s+UNIQUE)?\s+INDEX\b/gi) ?? []).length,
        dropIndex: (entry.content.match(/\bDROP\s+INDEX\b/gi) ?? []).length,
        dataBackfill: (entry.content.match(/\bUPDATE\s+["`]?core_/gi) ?? []).length,
      };
      return {
        id: entry.id,
        title: titleFromSlug(entry.id),
        sourcePath: entry.path,
        tables: uniqueTables,
        operationCounts,
        checksum: sha256(entry.content),
        sourceState: 'defined_in_repository',
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}
