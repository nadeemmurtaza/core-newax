import type { WidgetId, WidgetSize } from './widget';

/** Bump when a non-backward-compatible change is made to PlacedWidget/DashboardLayout's shape. */
export const LAYOUT_SCHEMA_VERSION = 1 as const;

export interface PlacedWidget {
  readonly widgetId: WidgetId;
  readonly size: WidgetSize;
  /** Position within the grid -- order, not pixel coordinates, so layout
   * stays valid across breakpoints instead of encoding one screen's geometry. */
  readonly order: number;
  /** Per-instance config a widget declared it accepts (filters, date range,
   * etc.) -- validated against the widget's own schema, never trusted blindly. */
  readonly config: Readonly<Record<string, string | number | boolean>>;
}

export type LayoutScope =
  | { readonly kind: 'user'; readonly accountId: string; readonly serviceId: string }
  | { readonly kind: 'organization'; readonly organizationId: string; readonly serviceId: string }
  | { readonly kind: 'service-default'; readonly serviceId: string };

export interface DashboardLayout {
  readonly schemaVersion: typeof LAYOUT_SCHEMA_VERSION;
  readonly scope: LayoutScope;
  readonly widgets: readonly PlacedWidget[];
  readonly updatedAt: string; // ISO 8601
}

/**
 * What /app/dashboard/customize actually works with: the three layers the
 * brief requires (service default, org default, user override), resolved
 * in that precedence order, not a single ambiguous "the layout."
 */
export interface ResolvedDashboardLayout {
  readonly effective: DashboardLayout;
  readonly source: 'user' | 'organization' | 'service-default';
  /** True when the user's/org's saved layout failed validation and this
   * is the safe service-default fallback instead -- the shell should
   * surface this, not silently discard the user's customization. */
  readonly recoveredFromInvalid: boolean;
}
