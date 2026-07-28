import { describe, expect, it } from 'vitest';

import { ContextAuthorizer } from '../src/security/context-authorizer';
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

function session(overrides: Partial<TrustedSessionRecord> = {}): TrustedSessionRecord {
  return {
    userId: '00000000-0000-4000-8000-000000000100',
    personId: '00000000-0000-4000-8000-000000000001',
    sessionId: '00000000-0000-4000-8000-000000000200',
    expiresAt: new Date('2026-07-12T08:00:00.000Z'),
    ...overrides,
  };
}

function membership(overrides: Partial<TrustedMembershipRecord> = {}): TrustedMembershipRecord {
  return {
    id: '00000000-0000-4000-8000-000000000300',
    personId: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000350',
    tenantStatus: 'active',
    organizationId: '00000000-0000-4000-8000-000000000400',
    membershipStatus: 'active',
    organizationStatus: 'active',
    ...overrides,
  };
}

class FakeSessionValidator implements TrustedSessionValidator {
  record: TrustedSessionRecord | null = session();

  async validateSession(_sessionToken: string): Promise<TrustedSessionRecord | null> {
    return this.record;
  }
}

class FakeMembershipDirectory implements TrustedMembershipDirectory {
  record: TrustedMembershipRecord | null = membership();

  async findMembershipById(_membershipId: string): Promise<TrustedMembershipRecord | null> {
    return this.record;
  }
}

class FakePermissionEvaluator implements TrustedPermissionEvaluator {
  record: TrustedPermissionEvaluation = {
    membershipId: membership().id,
    organizationId: membership().organizationId,
    evaluatedAt: now,
    effectivePermissionCodes: ['people.view', 'memberships.view'],
  };

  async evaluate(_membershipId: string, _evaluatedAt: Date): Promise<TrustedPermissionEvaluation> {
    return this.record;
  }
}

class FixedClock implements TrustedContextClock {
  now(): Date {
    return new Date(now.getTime());
  }
}

class FixedRequestIdFactory implements RequestIdFactory {
  issue(): string {
    return 'request-0001';
  }
}

function createService(): {
  readonly service: TrustedRequestContextService;
  readonly sessions: FakeSessionValidator;
  readonly memberships: FakeMembershipDirectory;
  readonly permissions: FakePermissionEvaluator;
} {
  const sessions = new FakeSessionValidator();
  const memberships = new FakeMembershipDirectory();
  const permissions = new FakePermissionEvaluator();
  return {
    service: new TrustedRequestContextService(
      sessions,
      memberships,
      permissions,
      new FixedClock(),
      new FixedRequestIdFactory(),
    ),
    sessions,
    memberships,
    permissions,
  };
}

describe('TrustedRequestContextService', () => {
  it('resolves authenticated account context without granting organization access', async () => {
    const { service } = createService();

    const context = await service.resolveAccountContext({
      sessionToken: 'opaque-session-token',
    });

    expect(context).toMatchObject({
      scope: 'account',
      requestId: 'request-0001',
      userId: session().userId,
      personId: session().personId,
      sessionId: session().sessionId,
    });
    expect('organizationId' in context).toBe(false);
  });

  it('returns one generic authentication failure for invalid sessions', async () => {
    const { service, sessions } = createService();
    sessions.record = null;

    await expect(
      service.resolveAccountContext({ sessionToken: 'invalid-session-token' }),
    ).rejects.toMatchObject({
      code: 'REQUEST_CONTEXT_AUTHENTICATION_REQUIRED',
      message: 'A valid authenticated session is required.',
    });
  });

  it('derives organization identity from the authenticated person membership', async () => {
    const { service } = createService();

    const context = await service.resolveOrganizationContext({
      sessionToken: 'opaque-session-token',
      membershipId: membership().id,
      requestId: 'external-request-id',
    });

    expect(context).toMatchObject({
      scope: 'organization',
      requestId: 'external-request-id',
      membershipId: membership().id,
      tenantId: membership().tenantId,
      organizationId: membership().organizationId,
    });
    expect([...context.permissionCodes]).toEqual(['memberships.view', 'people.view']);
    expect((context.permissionCodes as unknown as { add?: unknown }).add).toBeUndefined();
  });

  it('conceals missing, cross-person, and inactive memberships behind one failure', async () => {
    const { service, memberships } = createService();
    const candidates: Array<TrustedMembershipRecord | null> = [
      null,
      membership({ personId: '00000000-0000-4000-8000-000000000999' }),
      membership({ membershipStatus: 'suspended' }),
      membership({ organizationStatus: 'archived' }),
    ];

    for (const candidate of candidates) {
      memberships.record = candidate;
      await expect(
        service.resolveOrganizationContext({
          sessionToken: 'opaque-session-token',
          membershipId: membership().id,
        }),
      ).rejects.toMatchObject({
        code: 'REQUEST_CONTEXT_MEMBERSHIP_UNAVAILABLE',
      });
    }
  });

  it('rejects permission results from a different tenant boundary', async () => {
    const { service, permissions } = createService();
    permissions.record = {
      ...permissions.record,
      organizationId: '00000000-0000-4000-8000-000000000999',
    };

    await expect(
      service.resolveOrganizationContext({
        sessionToken: 'opaque-session-token',
        membershipId: membership().id,
      }),
    ).rejects.toMatchObject({ code: 'REQUEST_CONTEXT_INTEGRITY_FAILURE' });
  });
});

describe('ContextAuthorizer', () => {
  it('converts trusted organization context into existing module context contracts', async () => {
    const { service } = createService();
    const context = await service.resolveOrganizationContext({
      sessionToken: 'opaque-session-token',
      membershipId: membership().id,
    });
    const authorizer = new ContextAuthorizer();

    authorizer.requirePermission(context, 'people.view');
    expect(authorizer.toModuleContext(context)).toEqual({
      actorUserId: context.userId,
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      permissionCodes: context.permissionCodes,
    });
    expect(() => authorizer.requirePermission(context, 'people.archive')).toThrowError(
      expect.objectContaining({ code: 'REQUEST_CONTEXT_FORBIDDEN' }),
    );
  });
});
