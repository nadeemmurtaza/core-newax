import type { DashboardLayout, PlacedWidget, WidgetDefinition } from '@newaxhq/dashboard-contracts';
import type { WidgetRegistry } from './widget-registry';

export interface ComposedWidget {
  readonly placement: PlacedWidget;
  readonly widget: WidgetDefinition;
}

export interface ComposedDashboard {
  readonly widgets: readonly ComposedWidget[];
  /** Placed widgets dropped because they're no longer registered, or the
   * caller lacks the widget's required permission. Surfaced, not hidden --
   * the shell decides whether/how to tell the user something changed. */
  readonly dropped: readonly PlacedWidget[];
}

/**
 * Resolves a persisted layout against what's actually registered and what
 * the caller is actually allowed to see. Degrades by dropping widgets, the
 * same "never throws at render time" rule dashboard-contracts' layout
 * validation follows -- a widget retired or permission-revoked since the
 * layout was saved must not break the whole dashboard.
 */
export function composeDashboard(
  layout: DashboardLayout,
  registry: WidgetRegistry,
  grantedPermissions: ReadonlySet<string>,
): ComposedDashboard {
  const widgets: ComposedWidget[] = [];
  const dropped: PlacedWidget[] = [];

  for (const placement of layout.widgets) {
    const widget = registry.get(placement.widgetId);
    if (!widget) {
      dropped.push(placement);
      continue;
    }
    if (widget.requiredPermission !== null && !grantedPermissions.has(widget.requiredPermission)) {
      dropped.push(placement);
      continue;
    }
    widgets.push({ placement, widget });
  }

  widgets.sort((a, b) => a.placement.order - b.placement.order);

  return { widgets, dropped };
}
