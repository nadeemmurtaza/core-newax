import type { PermissionCode } from './permissions';

/**
 * A stable NEWAX service identifier -- "communicator", "erp", "harvester".
 * Matches the catalogue addendum's CoreService.parentApplication /
 * destinationKey convention (apps/api/src/catalogue), so a dashboard
 * service registration and a catalogue service entry can reference the
 * same identifier without inventing a second naming scheme.
 */
export type ServiceId = string;

const SERVICE_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;

export function isValidServiceId(value: unknown): value is ServiceId {
  return typeof value === 'string' && SERVICE_ID_PATTERN.test(value);
}

/**
 * Lifecycle state of a registered service -- distinct from whether a
 * specific *brand* has activated it (that's
 * CoreBrandServiceConfiguration.activationState in the catalogue). This
 * is "does this service exist and is Core allowed to render anything
 * from it at all," independent of any one tenant's entitlement.
 */
export type ServiceLifecycleState = 'draft' | 'approved' | 'deprecated' | 'retired';

export const SERVICE_LIFECYCLE_STATES: readonly ServiceLifecycleState[] = [
  'draft',
  'approved',
  'deprecated',
  'retired',
];

export function isServiceLifecycleState(value: unknown): value is ServiceLifecycleState {
  return (
    typeof value === 'string' && (SERVICE_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

/**
 * What a service declares to Core when it registers -- identity, display
 * metadata, and the navigation/widgets it contributes. Registration data
 * itself (not just the shape) belongs to whichever system ends up the
 * module registry's source of truth (see ECOSYSTEM.md's module-registry
 * note); this package only defines the contract both sides code against.
 */
export interface ServiceRegistration {
  readonly id: ServiceId;
  readonly displayName: string;
  readonly lifecycleState: ServiceLifecycleState;
  /** Permission required merely to see this service exists in /app/services. */
  readonly discoveryPermission: PermissionCode | null;
  readonly iconKey: string | null;
  readonly navigation: readonly ServiceNavigationItem[];
  readonly widgets: readonly string[]; // widget ids this service contributes; see widget.ts
  readonly contractVersion: string; // see version.ts
}

export interface ServiceNavigationItem {
  readonly id: string;
  readonly label: string;
  /** Path under the service's own route namespace, e.g. "/app/communicator/conversations". */
  readonly path: string;
  readonly iconKey: string | null;
  readonly requiredPermission: PermissionCode | null;
  readonly children: readonly ServiceNavigationItem[];
}
