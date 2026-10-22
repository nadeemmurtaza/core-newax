import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260716213000_add_people_intake_verification/migration.sql',
  ),
  'utf8',
);

describe('People Intake schema foundation', () => {
  it('owns a tenant- and organization-scoped JSON staging record', () => {
    expect(schema).toContain('model CorePeopleIntake');
    expect(schema).toContain('payload');
    expect(schema).toContain('@db.JsonB');
    expect(schema).toContain('@@map("core_people_intakes")');
  });

  it('enforces review, transition, scope, and immutability controls', () => {
    expect(migration).toContain('core_people_intakes_organization_scope_fkey');
    expect(migration).toContain('core_people_intakes_reviewer_check');
    expect(migration).toContain('core_people_intakes_state_check');
    expect(migration).toContain('core_people_intakes_transition_trigger');
    expect(migration).toContain('Submitted People Intake content is immutable');
    expect(migration).toContain('version exactly once');
  });
});
