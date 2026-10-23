import { describe, expect, it } from 'vitest';
import { WidgetRegistry } from '../src/widget-registry';
import type { WidgetDefinition } from '@newaxhq/dashboard-contracts';

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

describe('WidgetRegistry', () => {
  it('registers and retrieves a widget by id', () => {
    const registry = new WidgetRegistry();
    registry.register(widget());
    expect(registry.get('pending-invoices')?.displayName).toBe('Pending Invoices');
  });

  it('rejects an invalid widget id', () => {
    const registry = new WidgetRegistry();
    expect(() => registry.register(widget({ id: 'Pending Invoices' }))).toThrow(
      /Invalid widget id/,
    );
  });

  it('rejects re-registration by a different owner', () => {
    const registry = new WidgetRegistry();
    registry.register(widget());
    expect(() => registry.register(widget({ ownerServiceId: 'communicator' }))).toThrow(
      /already registered/,
    );
  });

  it('allows the same owner to re-register (update) its own widget', () => {
    const registry = new WidgetRegistry();
    registry.register(widget());
    registry.register(widget({ displayName: 'Pending Invoices v2' }));
    expect(registry.get('pending-invoices')?.displayName).toBe('Pending Invoices v2');
  });

  it('lists widgets by owning service', () => {
    const registry = new WidgetRegistry();
    registry.register(widget());
    registry.register(widget({ id: 'inbox-count', ownerServiceId: 'communicator' }));
    expect(registry.listByService('erp')).toHaveLength(1);
    expect(registry.list()).toHaveLength(2);
  });
});
