import { HEADERS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import type {
  CurrentPersonProfile,
  CurrentPersonRequestContext,
  PeopleService,
} from '@newax/people';
import type {
  TrustedAccountRequestContext,
  TrustedOrganizationRequestContext,
} from '@newax/request-context';

import {
  HTTP_CONTEXT_MODE_KEY,
  HTTP_REQUIRED_PERMISSIONS_KEY,
} from '../http-security/http-security.decorators';
import type { HttpSecurityRequestAdapter } from '../http-security/http-security-request';
import { CurrentPersonController } from './current-person.controller';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const SESSION_ID = '00000000-0000-4000-8000-000000000003';
const MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000004';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000005';
const TENANT_ID = '00000000-0000-4000-8000-000000000008';

const ACCOUNT_CONTEXT: TrustedAccountRequestContext = {
  scope: 'account',
  requestId: 'request-1',
  userId: USER_ID,
  personId: PERSON_ID,
  sessionId: SESSION_ID,
  sessionExpiresAt: new Date('2026-07-12T12:00:00.000Z'),
};

const ORGANIZATION_CONTEXT: TrustedOrganizationRequestContext = {
  scope: 'organization',
  requestId: 'request-1',
  userId: USER_ID,
  personId: PERSON_ID,
  sessionId: SESSION_ID,
  sessionExpiresAt: new Date('2026-07-12T12:00:00.000Z'),
  membershipId: MEMBERSHIP_ID,
  tenantId: TENANT_ID,
  organizationId: ORGANIZATION_ID,
  permissionCodes: new Set(['people.view']),
  evaluatedAt: new Date('2026-07-12T10:00:00.000Z'),
};

const PROFILE: CurrentPersonProfile = {
  id: PERSON_ID,
  firstName: 'Nadeem',
  middleName: 'Muhammad',
  lastName: 'Murtaza',
  preferredName: 'Nadeem',
  status: 'active',
};

class FakePeopleService {
  context: CurrentPersonRequestContext | null = null;

  async getCurrent(context: CurrentPersonRequestContext): Promise<CurrentPersonProfile> {
    this.context = context;
    return PROFILE;
  }
}

function request(
  context?: TrustedAccountRequestContext | TrustedOrganizationRequestContext,
): HttpSecurityRequestAdapter {
  return {
    method: 'GET',
    headers: {},
    ...(context === undefined ? {} : { trustedContext: context }),
  };
}

describe('CurrentPersonController', () => {
  it('reads only the authenticated account person and returns a bounded profile', async () => {
    const people = new FakePeopleService();
    const controller = new CurrentPersonController(people as unknown as PeopleService);

    const result = await controller.get(request(ACCOUNT_CONTEXT), {});

    expect(people.context).toEqual({
      actorUserId: USER_ID,
      personId: PERSON_ID,
    });
    expect(result).toEqual({
      success: true,
      data: {
        id: PERSON_ID,
        first_name: 'Nadeem',
        middle_name: 'Muhammad',
        last_name: 'Murtaza',
        preferred_name: 'Nadeem',
        status: 'active',
      },
    });
    expect(result.data).not.toHaveProperty('date_of_birth');
    expect(result.data).not.toHaveProperty('gender');
    expect(result.data).not.toHaveProperty('identifiers');
    expect(result.data).not.toHaveProperty('contacts');
    expect(result.data).not.toHaveProperty('memberships');
    expect(result.data).not.toHaveProperty('roles');
    expect(result.data).not.toHaveProperty('permissions');
    expect(result.data).not.toHaveProperty('created_at');
    expect(result.data).not.toHaveProperty('updated_at');
    expect(result.data).not.toHaveProperty('deleted_at');
  });

  it.each([
    { person_id: PERSON_ID },
    { user_id: USER_ID },
    { organization_id: ORGANIZATION_ID },
    { include: 'memberships' },
    { arbitrary: 'value' },
  ])('rejects every query parameter, including client person selection', async (query) => {
    const controller = new CurrentPersonController(
      new FakePeopleService() as unknown as PeopleService,
    );

    await expect(controller.get(request(ACCOUNT_CONTEXT), query)).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 400,
    });
  });

  it('fails closed when trusted account context was not established', async () => {
    const controller = new CurrentPersonController(
      new FakePeopleService() as unknown as PeopleService,
    );

    await expect(controller.get(request(), {})).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 500,
    });
  });

  it('rejects organization context even when it grants people.view', async () => {
    const controller = new CurrentPersonController(
      new FakePeopleService() as unknown as PeopleService,
    );

    await expect(controller.get(request(ORGANIZATION_CONTEXT), {})).rejects.toMatchObject({
      code: 'HTTP_SECURITY_INVALID_INPUT',
      statusCode: 500,
    });
  });

  it('requires authenticated account context without organization permissions', () => {
    const handler = CurrentPersonController.prototype.get;

    expect(Reflect.getMetadata(HTTP_CONTEXT_MODE_KEY, handler)).toBe('account');
    expect(Reflect.getMetadata(HTTP_REQUIRED_PERMISSIONS_KEY, handler)).toBeUndefined();
  });

  it('declares Cache-Control no-store', () => {
    const headers = Reflect.getMetadata(
      HEADERS_METADATA,
      CurrentPersonController.prototype.get,
    ) as readonly { readonly name: string; readonly value: string }[];

    expect(headers).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });
});
