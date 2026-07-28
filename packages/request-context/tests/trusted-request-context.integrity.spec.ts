import { describe, expect, it } from 'vitest';

import type {
  RequestIdFactory,
  TrustedContextClock,
  TrustedMembershipDirectory,
  TrustedPermissionEvaluator,
  TrustedSessionValidator,
} from '../src/services/request-context-ports';
import { TrustedRequestContextService } from '../src/services/trusted-request-context.service';
import type {
  TrustedMembershipRecord,
  TrustedPermissionEvaluation,
  TrustedSessionRecord,
} from '../src/types/request-context';

const now = new Date('2026-07-12T00:00:00.000Z');
const membershipId = '00000000-0000-4000-8000-000000000300';
const tenantId = '00000000-0000-4000-8000-000000000350';
const organizationId = '00000000-0000-4000-8000-000000000400';
const personId = '00000000-0000-4000-8000-000000000001';

class SessionValidator implements TrustedSessionValidator {
  record: TrustedSessionRecord = {
    userId: '00000000-0000-4000-8000-000000000100',
    personId,
    sessionId: '00000000-0000-4000-8000-000000000200',
    expiresAt: new Date('2026-07-12T08:00:00.000Z'),
  };

  async validateSession(): Promise<TrustedSessionRecord> {
    return this.record;
  }
}

class MembershipDirectory implements TrustedMembershipDirectory {
  calls = 0;
  record: TrustedMembershipRecord = {
    id: membershipId,
    personId,
    tenantId,
    tenantStatus: 'active',
    organizationId,
    membershipStatus: 'active',
    organizationStatus: 'active',
  };

  async findMembershipById(): Promise<TrustedMembershipRecord> {
    this.calls += 1;
    return this.record;
  }
}

class PermissionEvaluator implements TrustedPermissionEvaluator {
  record: TrustedPermissionEvaluation = {
    membershipId,
    organizationId,
    evaluatedAt: now,
    effectivePermissionCodes: ['people.view'],
  };

  async evaluate(): Promise<TrustedPermissionEvaluation> {
    return this.record;
  }
}

class Clock implements TrustedContextClock {
  now(): Date {
    return new Date(now.getTime());
  }
}

class RequestIds implements RequestIdFactory {
  issue(): string {
    return 'request-integrity-test';
  }
}

function fixture(): {
  readonly service: TrustedRequestContextService;
  readonly sessions: SessionValidator;
  readonly memberships: MembershipDirectory;
  readonly permissions: PermissionEvaluator;
} {
  const sessions = new SessionValidator();
  const memberships = new MembershipDirectory();
  const permissions = new PermissionEvaluator();
  return {
    service: new TrustedRequestContextService(
      sessions,
      memberships,
      permissions,
      new Clock(),
      new RequestIds(),
    ),
    sessions,
    memberships,
    permissions,
  };
}

describe('TrustedRequestContextService integrity controls', () => {
  it('conceals malformed membership identifiers without querying persistence', async () => {
    const { service, memberships } = fixture();

    await expect(
      service.resolveOrganizationContext({
        sessionToken: 'opaque-session-token',
        membershipId: 'not-a-uuid',
      }),
    ).rejects.toMatchObject({
      code: 'REQUEST_CONTEXT_MEMBERSHIP_UNAVAILABLE',
    });
    expect(memberships.calls).toBe(0);
  });

  it('rejects expired records even when a session adapter returns them', async () => {
    const { service, sessions } = fixture();
    sessions.record = {
      ...sessions.record,
      expiresAt: new Date('2026-07-11T23:59:59.000Z'),
    };

    await expect(
      service.resolveAccountContext({ sessionToken: 'opaque-session-token' }),
    ).rejects.toMatchObject({
      code: 'REQUEST_CONTEXT_AUTHENTICATION_REQUIRED',
    });
  });

  it('rejects membership directory identifier mismatches', async () => {
    const { service, memberships } = fixture();
    memberships.record = {
      ...memberships.record,
      id: '00000000-0000-4000-8000-000000000999',
    };

    await expect(
      service.resolveOrganizationContext({
        sessionToken: 'opaque-session-token',
        membershipId,
      }),
    ).rejects.toMatchObject({ code: 'REQUEST_CONTEXT_INTEGRITY_FAILURE' });
  });

  it('rejects malformed permission codes from trusted persistence', async () => {
    const { service, permissions } = fixture();
    permissions.record = {
      ...permissions.record,
      effectivePermissionCodes: ['people.view', ' people.archive '],
    };

    await expect(
      service.resolveOrganizationContext({
        sessionToken: 'opaque-session-token',
        membershipId,
      }),
    ).rejects.toMatchObject({ code: 'REQUEST_CONTEXT_INTEGRITY_FAILURE' });
  });
});
