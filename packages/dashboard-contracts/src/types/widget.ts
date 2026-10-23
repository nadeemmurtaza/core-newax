import type { PermissionCode } from './permissions';
import type { ServiceId } from './service';

export type WidgetId = string;

const WIDGET_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/u;

export function isValidWidgetId(value: unknown): value is WidgetId {
  return typeof value === 'string' && WIDGET_ID_PATTERN.test(value);
}

/** How much grid space a widget occupies -- an abstract size class, not pixels,
 * so the layout stays meaningful across breakpoints (seven-tier responsive
 * rule: density changes, the architecture doesn't). */
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export const WIDGET_SIZES: readonly WidgetSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

export function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === 'string' && (WIDGET_SIZES as readonly string[]).includes(value);
}

/**
 * Static metadata a service declares for one widget it contributes. The
 * widget's actual data comes from `dataAdapter`, never from a value
 * embedded here -- this record is presentation/registration metadata
 * only, safe to cache and list in /app/dashboard/customize without
 * touching the owning service's backend.
 */
export interface WidgetDefinition {
  readonly id: WidgetId;
  readonly ownerServiceId: ServiceId;
  readonly displayName: string;
  readonly description: string;
  readonly iconKey: string | null;
  readonly defaultSize: WidgetSize;
  readonly supportedSizes: readonly WidgetSize[];
  /** Null = visible to anyone with access to the owning service; non-null =
   * an additional permission beyond service access. */
  readonly requiredPermission: PermissionCode | null;
  readonly dataAdapter: WidgetDataAdapterRef;
  readonly contractVersion: string;
}

/**
 * A reference to where a widget's data comes from -- never the data
 * itself, and never a raw URL a browser widget could be tricked into
 * substituting (that would be exactly the "browser registers arbitrary
 * executable code as a widget" case the brief forbids). Core resolves
 * `endpointKey` server-side against the owning service's approved,
 * versioned API the same way the catalogue resolves `destinationKey`
 * (apps/api/src/catalogue) -- a stable key, not a client-suppliable URL.
 */
export interface WidgetDataAdapterRef {
  readonly ownerServiceId: ServiceId;
  readonly endpointKey: string;
  /** Soft ceiling the shell may use for loading-state UX; the owning
   * service's backend is the actual timeout authority. */
  readonly expectedLoadMs: number;
}
