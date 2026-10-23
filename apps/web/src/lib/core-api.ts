/**
 * Client for NEWAX Core's own API (apps/api), reached through this app's
 * same-origin `/api/*` rewrite (see next.config.ts) so the session and CSRF
 * cookies `apps/api`'s SecureCookieTransport sets are first-party.
 *
 * Session + membership-context model (see apps/api's http-security package):
 * - `__Host-newax_session` -- httpOnly session cookie, never read here.
 * - `__Host-newax_csrf` -- readable CSRF cookie; its value is echoed back
 *   as the `x-newax-csrf` header on state-changing requests.
 * - `x-newax-membership-id` -- sent on requests that should be scoped to a
 *   specific organization membership (selecting the "active organization").
 *
 * Open question, recorded rather than invented: nothing currently
 * exchanges an nID session for this app's session cookie. apps/api's
 * POST /auth/login is password-based (@newax/auth's PasswordLoginInput);
 * there's no nID-token-in, Core-session-out endpoint yet. Every page here
 * calls requireSession() and renders the Unauthorized screen when there is
 * none, which is the correct and honest behavior until that bridge exists
 * -- not a fake "signed in" state.
 */

const CSRF_COOKIE_NAME = '__Host-newax_csrf';
const CSRF_HEADER_NAME = 'x-newax-csrf';
const MEMBERSHIP_HEADER_NAME = 'x-newax-membership-id';

export class CoreApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export class CoreApiUnauthenticatedError extends CoreApiError {
  constructor() {
    super('No active NEWAX Core session.', 401);
  }
}

function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE_NAME.length + 1)) : null;
}

interface CoreFetchOptions extends RequestInit {
  /** Scopes the request to this organization membership via x-newax-membership-id. */
  membershipId?: string;
}

export async function coreFetch<T>(path: string, options: CoreFetchOptions = {}): Promise<T> {
  const { membershipId, headers, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD';

  const requestHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (membershipId) {
    requestHeaders[MEMBERSHIP_HEADER_NAME] = membershipId;
  }
  if (isMutation) {
    const csrf = readCsrfCookie();
    if (csrf) {
      requestHeaders[CSRF_HEADER_NAME] = csrf;
    }
  }

  const res = await fetch(`/api${path}`, {
    ...rest,
    method,
    headers: requestHeaders,
    credentials: 'include',
  });

  if (res.status === 401) {
    throw new CoreApiUnauthenticatedError();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new CoreApiError(
      body?.message ?? `Request to ${path} failed with ${res.status}`,
      res.status,
    );
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export interface CoreSession {
  authenticated: true;
  userId: string;
  personId: string;
  sessionId: string;
  expiresAt: string;
}

export function getSession(): Promise<CoreSession> {
  return coreFetch<CoreSession>('/auth/session');
}

export function logout(): Promise<void> {
  return coreFetch('/auth/logout', { method: 'POST' });
}

export interface Membership {
  membershipId: string;
  organizationId: string;
  organizationDisplayName: string;
  organizationType: string;
  membershipType: string;
  jobTitle: string | null;
  startDate: string | null;
}

interface MembershipListResponse {
  success: true;
  data: ReadonlyArray<{
    membership_id: string;
    organization_id: string;
    organization_display_name: string;
    organization_type: string;
    membership_type: string;
    job_title: string | null;
    start_date: string | null;
  }>;
  meta: { page: number; per_page: number; total: number };
}

export async function listMyMemberships(): Promise<Membership[]> {
  const res = await coreFetch<MembershipListResponse>('/account/memberships');
  return res.data.map((item) => ({
    membershipId: item.membership_id,
    organizationId: item.organization_id,
    organizationDisplayName: item.organization_display_name,
    organizationType: item.organization_type,
    membershipType: item.membership_type,
    jobTitle: item.job_title,
    startDate: item.start_date,
  }));
}

export interface OrganizationContext {
  tenantId: string;
  membershipId: string;
  organization: { id: string; displayName: string; type: string };
  membership: { type: string; jobTitle: string | null };
  sessionExpiresAt: string;
  permissionsEvaluatedAt: string;
  capabilities: {
    organizationView: boolean;
    organizationManage: boolean;
    peopleView: boolean;
    peopleManage: boolean;
    membershipsView: boolean;
    membershipsManage: boolean;
    usersView: boolean;
    usersManage: boolean;
    accessControlView: boolean;
    accessControlManage: boolean;
  };
}

interface OrganizationContextResponse {
  success: true;
  data: {
    tenant_id: string;
    membership_id: string;
    organization: { id: string; display_name: string; type: string };
    membership: { type: string; job_title: string | null };
    session_expires_at: string;
    permissions_evaluated_at: string;
    capabilities: {
      organization_view: boolean;
      organization_manage: boolean;
      people_view: boolean;
      people_manage: boolean;
      memberships_view: boolean;
      memberships_manage: boolean;
      users_view: boolean;
      users_manage: boolean;
      access_control_view: boolean;
      access_control_manage: boolean;
    };
  };
}

export async function confirmOrganizationContext(
  membershipId: string,
): Promise<OrganizationContext> {
  const res = await coreFetch<OrganizationContextResponse>('/account/organization-context', {
    membershipId,
  });
  const c = res.data.capabilities;
  return {
    tenantId: res.data.tenant_id,
    membershipId: res.data.membership_id,
    organization: {
      id: res.data.organization.id,
      displayName: res.data.organization.display_name,
      type: res.data.organization.type,
    },
    membership: { type: res.data.membership.type, jobTitle: res.data.membership.job_title },
    sessionExpiresAt: res.data.session_expires_at,
    permissionsEvaluatedAt: res.data.permissions_evaluated_at,
    capabilities: {
      organizationView: c.organization_view,
      organizationManage: c.organization_manage,
      peopleView: c.people_view,
      peopleManage: c.people_manage,
      membershipsView: c.memberships_view,
      membershipsManage: c.memberships_manage,
      usersView: c.users_view,
      usersManage: c.users_manage,
      accessControlView: c.access_control_view,
      accessControlManage: c.access_control_manage,
    },
  };
}

// ---------------------------------------------------------------------------
// Service catalogue (NEWAX_CORE_SERVICE_CATALOGUE_AND_MODULE_PAGES_ADDENDUM
// _v1) -- P0 slice: brands, catalogue, category, launch-state resolution.
// Every call below still needs a confirmed organization context (the
// membershipId), same as the identity-brief endpoints above.
// ---------------------------------------------------------------------------

export interface Brand {
  id: string;
  displayName: string;
  slug: string;
}

interface BrandListResponse {
  success: true;
  data: ReadonlyArray<{ id: string; display_name: string; slug: string }>;
}

export async function listBrands(membershipId: string): Promise<Brand[]> {
  const res = await coreFetch<BrandListResponse>('/core/organizations/current/brands', {
    membershipId,
  });
  return res.data.map((b) => ({ id: b.id, displayName: b.display_name, slug: b.slug }));
}

export type ServiceAvailability = 'available' | 'active' | 'setup_required' | 'unavailable';

export interface CatalogueService {
  id: string;
  code: string;
  displayName: string;
  outcomeDescription: string;
  iconKey: string | null;
  availability: ServiceAvailability;
}

export interface CatalogueCategory {
  id: string;
  code: string;
  label: string;
  description: string | null;
  services: CatalogueService[];
}

interface ServiceResource {
  id: string;
  code: string;
  display_name: string;
  outcome_description: string;
  icon_key: string | null;
  availability: ServiceAvailability;
}

interface CategoryResource {
  id: string;
  code: string;
  label: string;
  description: string | null;
  services: readonly ServiceResource[];
}

function toCatalogueService(r: ServiceResource): CatalogueService {
  return {
    id: r.id,
    code: r.code,
    displayName: r.display_name,
    outcomeDescription: r.outcome_description,
    iconKey: r.icon_key,
    availability: r.availability,
  };
}

function toCatalogueCategory(r: CategoryResource): CatalogueCategory {
  return {
    id: r.id,
    code: r.code,
    label: r.label,
    description: r.description,
    services: r.services.map(toCatalogueService),
  };
}

export async function getBrandCatalogue(
  membershipId: string,
  brandId: string,
): Promise<CatalogueCategory[]> {
  const res = await coreFetch<{ success: true; data: { categories: readonly CategoryResource[] } }>(
    `/core/brands/${brandId}/catalogue`,
    { membershipId },
  );
  return res.data.categories.map(toCatalogueCategory);
}

export async function getServiceCategory(
  membershipId: string,
  brandId: string,
  categoryId: string,
): Promise<CatalogueCategory> {
  const res = await coreFetch<{ success: true; data: CategoryResource }>(
    `/core/brands/${brandId}/catalogue/categories/${categoryId}`,
    { membershipId },
  );
  return toCatalogueCategory(res.data);
}

export type LaunchOutcome =
  | { outcome: 'blocked_no_bridge' }
  | { outcome: 'setup_required' }
  | { outcome: 'unavailable'; reason: 'disabled' | 'not_entitled' }
  | { outcome: 'not_found' };

export async function resolveServiceLaunch(
  membershipId: string,
  brandId: string,
  serviceCode: string,
): Promise<{ service: CatalogueService | null; launch: LaunchOutcome }> {
  const res = await coreFetch<{
    success: true;
    data: { service: ServiceResource | null; launch: LaunchOutcome };
  }>(`/core/brands/${brandId}/catalogue/services/${serviceCode}/launch`, { membershipId });
  return {
    service: res.data.service ? toCatalogueService(res.data.service) : null,
    launch: res.data.launch,
  };
}
