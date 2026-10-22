/**
 * Ecosystem-wide Constants & Headers.
 */

export const ECOSYSTEM_HEADERS = {
  TENANT_ID: 'x-tenant-id',
  ORGANIZATION_ID: 'x-organization-id',
  ACTOR_ID: 'x-actor-id',
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
} as const;

export const PAGINATION_DEFAULTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const TIME_CONSTANTS = {
  ONE_SECOND_MS: 1_000,
  ONE_MINUTE_MS: 60_000,
  ONE_HOUR_MS: 3_600_000,
  ONE_DAY_MS: 86_400_000,
} as const;
