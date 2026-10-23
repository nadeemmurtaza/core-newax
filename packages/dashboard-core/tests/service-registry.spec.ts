import { describe, expect, it } from 'vitest';
import { ServiceRegistry } from '../src/service-registry';
import type { ServiceRegistration } from '@newaxhq/dashboard-contracts';

function service(overrides: Partial<ServiceRegistration> = {}): ServiceRegistration {
  return {
    id: 'erp',
    displayName: 'ERP',
    lifecycleState: 'approved',
    discoveryPermission: null,
    iconKey: null,
    navigation: [],
    widgets: [],
    contractVersion: '1.0.0',
    ...overrides,
  };
}

describe('ServiceRegistry', () => {
  it('registers and retrieves a service', () => {
    const registry = new ServiceRegistry();
    registry.register(service());
    expect(registry.get('erp')?.displayName).toBe('ERP');
  });

  it('rejects duplicate registration of the same service id', () => {
    const registry = new ServiceRegistry();
    registry.register(service());
    expect(() => registry.register(service())).toThrow(/already registered/);
  });

  it('filters discoverable services by granted permissions', () => {
    const registry = new ServiceRegistry();
    registry.register(service());
    registry.register(service({ id: 'healthcare', discoveryPermission: 'healthcare.discover' }));

    expect(registry.listDiscoverable(new Set())).toHaveLength(1);
    expect(registry.listDiscoverable(new Set(['healthcare.discover']))).toHaveLength(2);
  });
});
