import { describe, expect, it } from 'vitest';
import { composeDashboard } from '../src/compose-layout';
import { WidgetRegistry } from '../src/widget-registry';
import type { DashboardLayout, WidgetDefinition } from '@newaxhq/dashboard-contracts';

function widget(overrides: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return {
    id: 'pending-invoices',
    ownerServiceId: 'erp',
    displayName: 'Pending Invoices',
    description: 'Invoices awaiting approval.',
    iconKey: null,
    defaultSize: 'md',
    supportedSizes: ['sm', 'md', 'lg'],
    requiredPermission: null,
    dataAdapter: { ownerServiceId: 'erp', endpointKey: 'invoices.pending', expectedLoadMs: 500 },
    contractVersion: '1.0.0',
    ...overrides,
  };
}

function layout(widgetIds: Array<{ id: string; order: number }>): DashboardLayout {
  return {
    schemaVersion: 1,
    scope: { kind: 'service-default', serviceId: 'erp' },
    widgets: widgetIds.map(({ id, order }) => ({ widgetId: id, size: 'md', order, config: {} })),
    updatedAt: new Date().toISOString(),
  };
}

describe('composeDashboard', () => {
  it('resolves placements against registered widgets, sorted by order', () => {
    const registry = new WidgetRegistry();
    registry.register(widget({ id: 'widget-a' }));
    registry.register(widget({ id: 'widget-b' }));

    const result = composeDashboard(
      layout([
        { id: 'widget-b', order: 1 },
        { id: 'widget-a', order: 0 },
      ]),
      registry,
      new Set(),
    );

    expect(result.widgets.map((w) => w.widget.id)).toEqual(['widget-a', 'widget-b']);
    expect(result.dropped).toHaveLength(0);
  });

  it('drops a placement whose widget is no longer registered', () => {
    const registry = new WidgetRegistry();
    const result = composeDashboard(
      layout([{ id: 'retired-widget', order: 0 }]),
      registry,
      new Set(),
    );

    expect(result.widgets).toHaveLength(0);
    expect(result.dropped).toHaveLength(1);
  });

  it('drops a placement the caller lacks permission for', () => {
    const registry = new WidgetRegistry();
    registry.register(widget({ id: 'widget-a', requiredPermission: 'invoices.read' }));

    const withoutPermission = composeDashboard(
      layout([{ id: 'widget-a', order: 0 }]),
      registry,
      new Set(),
    );
    expect(withoutPermission.widgets).toHaveLength(0);
    expect(withoutPermission.dropped).toHaveLength(1);

    const withPermission = composeDashboard(
      layout([{ id: 'widget-a', order: 0 }]),
      registry,
      new Set(['invoices.read']),
    );
    expect(withPermission.widgets).toHaveLength(1);
  });
});
