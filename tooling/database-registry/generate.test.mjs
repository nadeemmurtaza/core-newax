import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildInventory,
  detectGlobalPrefix,
  parseControllersFromFiles,
  parseMigrations,
  parseModuleRegistry,
  parsePrismaSchema,
  renderHtml,
  run,
  safeJsonForHtml,
} from './generate.mjs';

const SCHEMA = `
generator client {
  provider = "prisma-client"
}

datasource db {
  provider = "postgresql"
}

model CoreTenant {
  id            String             @id @default(uuid()) @db.Uuid
  name          String             @db.VarChar(255)
  organizations CoreOrganization[]

  @@map("core_tenants")
}

model CoreOrganization {
  id       String     @id @default(uuid()) @db.Uuid
  tenantId String     @map("tenant_id") @db.Uuid
  name     String
  tenant   CoreTenant @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@unique([tenantId, id])
  @@map("core_organizations")
}
`;

const REGISTRY = JSON.stringify(
  {
    registry_name: 'NEWAX Module Registry',
    registry_key: 'newax-module-registry',
    registry_version: '0.1.0',
    registry_status: 'draft',
    last_updated: '2026-07-15',
    owner: 'NEWAX Engineering',
    purpose: 'Test registry.',
    governance: {},
    modules: [
      {
        module_name: 'Tenants',
        module_key: 'tenants',
        module_layer: 'foundation',
        module_version: '0.1.0',
        module_status: 'draft',
        module_owner: 'NEWAX Engineering',
        description: 'Customer ownership boundary.',
        dependencies: [],
        required_permissions: ['tenants.view'],
        exposed_events: ['tenant.created'],
        consumed_events: [],
        configuration_options: [],
        database_ownership: ['core_tenants'],
        tenant_scope: 'global_customer_boundary',
        documentation_path: 'packages/tenants/README.md',
        changelog_path: 'packages/tenants/CHANGELOG.md',
        compatibility_notes: 'Billing remains deferred.',
      },
      {
        module_name: 'Organizations',
        module_key: 'organizations',
        module_layer: 'foundation',
        module_version: '0.1.0',
        module_status: 'planned',
        module_owner: 'NEWAX Engineering',
        description: 'Organization boundary.',
        dependencies: [{ module_key: 'tenants', version: '>=0.1.0' }],
        required_permissions: ['organizations.view'],
        exposed_events: [],
        consumed_events: [],
        configuration_options: [],
        database_ownership: ['core_organizations'],
        tenant_scope: 'tenant_scoped',
        documentation_path: 'packages/organizations/README.md',
        changelog_path: 'packages/organizations/CHANGELOG.md',
        compatibility_notes: '',
      },
    ],
  },
  null,
  2,
);

const CONTROLLER = `
import { Controller, Get, HttpCode, Post } from '@nestjs/common';

@Controller('core/organizations/current')
export class CurrentOrganizationController {
  @Get()
  @OrganizationContextEndpoint()
  @RequirePermissions(ORGANIZATION_PERMISSIONS.view)
  async get() {}

  @Post('confirm')
  @HttpCode(202)
  @AccountContextEndpoint()
  async confirm() {}
}
`;

function createFixtureRepository() {
  const root = mkdtempSync(join(tmpdir(), 'newax-database-registry-'));
  mkdirSync(join(root, 'apps/api/prisma/migrations/20260715000000_create_core'), {
    recursive: true,
  });
  mkdirSync(join(root, 'apps/api/src/organizations'), { recursive: true });
  mkdirSync(join(root, 'registry'), { recursive: true });
  writeFileSync(join(root, 'apps/api/prisma/schema.prisma'), SCHEMA);
  writeFileSync(join(root, 'registry/module-registry.json'), REGISTRY);
  writeFileSync(join(root, 'apps/api/src/main.ts'), "app.setGlobalPrefix('api');\n");
  writeFileSync(
    join(root, 'apps/api/src/organizations/current-organization.controller.ts'),
    CONTROLLER,
  );
  writeFileSync(
    join(root, 'apps/api/prisma/migrations/20260715000000_create_core/migration.sql'),
    'CREATE TABLE "core_tenants" ("id" UUID PRIMARY KEY);\nALTER TABLE "core_organizations" ADD COLUMN "tenant_id" UUID;\n',
  );
  return root;
}

test('parses Prisma models, mappings and relations', () => {
  const parsed = parsePrismaSchema(SCHEMA);
  assert.equal(parsed.models.length, 2);
  assert.equal(parsed.relations.length, 1);
  assert.equal(
    parsed.models.find((model) => model.name === 'CoreTenant').tableName,
    'core_tenants',
  );
  assert.deepEqual(parsed.relations[0], {
    source: 'CoreOrganization',
    target: 'CoreTenant',
    field: 'tenant',
    relationName: null,
    optional: false,
    list: false,
  });
});

test('parses module governance, dependencies and delivery state', () => {
  const parsed = parseModuleRegistry(REGISTRY);
  assert.equal(parsed.modules.length, 2);
  assert.equal(parsed.modules[0].deliveryState, 'planned');
  assert.equal(parsed.modules[1].deliveryState, 'implemented_draft');
  assert.equal(parsed.modules[0].dependencies[0].key, 'tenants');
});

test('detects API prefix and controller routes without inventing permissions', () => {
  assert.equal(detectGlobalPrefix("app.setGlobalPrefix('api');"), 'api');
  assert.equal(
    detectGlobalPrefix("const API_PREFIX = 'api';\napp.setGlobalPrefix(API_PREFIX);"),
    'api',
  );
  const endpoints = parseControllersFromFiles(
    [{ path: 'controller.ts', content: CONTROLLER }],
    'api',
  );
  assert.equal(endpoints.length, 2);
  assert.deepEqual(
    endpoints.map(({ method, path, context, permissions, successCode }) => ({
      method,
      path,
      context,
      permissions,
      successCode,
    })),
    [
      {
        method: 'GET',
        path: '/api/core/organizations/current',
        context: 'organization',
        permissions: ['ORGANIZATION_PERMISSIONS.view'],
        successCode: 200,
      },
      {
        method: 'POST',
        path: '/api/core/organizations/current/confirm',
        context: 'account',
        permissions: [],
        successCode: 202,
      },
    ],
  );
});

test('recognizes class-level and authentication public endpoint decorators', () => {
  const endpoints = parseControllersFromFiles(
    [
      {
        path: 'health.controller.ts',
        content: `
@Controller('health')
@PublicEndpoint()
export class HealthController {
  @Get()
  getHealth() {}
}
`,
      },
      {
        path: 'authentication.controller.ts',
        content: `
@Controller('auth')
export class AuthenticationController {
  @Post('login')
  @HttpCode(200)
  @PublicAuthenticationEndpoint()
  login() {}
}
`,
      },
    ],
    'api',
  );

  assert.deepEqual(
    endpoints.map(({ method, path, context, successCode }) => ({
      method,
      path,
      context,
      successCode,
    })),
    [
      { method: 'POST', path: '/api/auth/login', context: 'public', successCode: 200 },
      { method: 'GET', path: '/api/health', context: 'public', successCode: 200 },
    ],
  );
});

test('classifies migration operations and fingerprints source', () => {
  const migrations = parseMigrations([
    {
      id: '20260715000000_create_core',
      path: 'migration.sql',
      content:
        'CREATE TABLE "core_tenants" ("id" UUID);\nALTER TABLE "core_organizations" ADD COLUMN "tenant_id" UUID;\nCREATE INDEX "core_org_idx" ON "core_organizations"("tenant_id");',
    },
  ]);
  assert.equal(migrations[0].operationCounts.createTable, 1);
  assert.equal(migrations[0].operationCounts.alterTable, 1);
  assert.equal(migrations[0].operationCounts.createIndex, 1);
  assert.deepEqual(migrations[0].tables, ['core_organizations', 'core_tenants']);
  assert.equal(migrations[0].checksum.length, 64);
});

test('escapes embedded inventory data before inserting it into HTML', () => {
  assert.equal(safeJsonForHtml({ value: '</script><script>' }).includes('</script>'), false);
});

test('builds deterministic snapshot inventory and interactive HTML', async () => {
  const root = createFixtureRepository();
  try {
    const first = await buildInventory({ root, mode: 'snapshot' });
    const second = await buildInventory({ root, mode: 'snapshot' });
    assert.deepEqual(first, second);
    assert.equal(first.database.modelCount, 2);
    assert.equal(first.api.endpointCount, 2);
    assert.equal(first.delivery.plannedModuleCount, 1);
    assert.equal(first.delivery.deferredItems[0].text, 'Billing remains deferred.');
    const html = renderHtml(first);
    assert.match(html, /NEWAX Core Database Registry/);
    assert.match(html, /database-map/);
    assert.match(html, /Download inventory/);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length >= 2);
    assert.doesNotThrow(() => new Function(scripts.at(-1)[1]));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('writes and verifies generated outputs', async () => {
  const root = createFixtureRepository();
  try {
    await run(['--root', root, '--output', 'generated/database-registry', '--mode', 'snapshot']);
    assert.match(
      readFileSync(join(root, 'generated/database-registry/index.html'), 'utf8'),
      /NEWAX Core Database Registry/,
    );
    await run([
      '--root',
      root,
      '--output',
      'generated/database-registry',
      '--mode',
      'snapshot',
      '--check',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
