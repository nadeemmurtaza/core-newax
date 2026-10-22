import { describe, expect, it } from 'vitest';
import { EventBus, ModuleGatewayClient } from '../src/index.js';

describe('@newax/module-gateway (Decoupled Event Bus & Gateway Client)', () => {
  it('publishes and subscribes to exact domain events', async () => {
    const bus = new EventBus();
    const received: string[] = [];

    bus.subscribe<{ orderId: string }>('order.placed', (event) => {
      received.push(event.payload.orderId);
    });

    const res = await bus.publish(
      'order.placed',
      { orderId: 'ORD-101' },
      {
        tenantId: 'tenant-pk-1',
        sourceModule: 'erp-1',
      },
    );

    expect(res.status).toBe('dispatched');
    expect(res.eventId).toMatch(/^evt_/);
    expect(received).toEqual(['ORD-101']);
  });

  it('supports wildcard domain event subscriptions', async () => {
    const bus = new EventBus();
    const intercepted: string[] = [];

    bus.subscribe('inventory.*', (event) => {
      intercepted.push(event.name);
    });

    await bus.publish('inventory.reserved', { sku: 'SKU-1' }, { tenantId: 'tenant-1' });
    await bus.publish('inventory.released', { sku: 'SKU-2' }, { tenantId: 'tenant-1' });
    await bus.publish('order.created', { orderId: 'ORD-1' }, { tenantId: 'tenant-1' });

    expect(intercepted).toEqual(['inventory.reserved', 'inventory.released']);
  });

  it('unsubscribes listeners cleanly', async () => {
    const bus = new EventBus();
    let count = 0;

    const sub = bus.subscribe('lead.captured', () => {
      count++;
    });

    await bus.publish('lead.captured', {}, { tenantId: 'tenant-1' });
    expect(count).toBe(1);

    sub.unsubscribe();
    await bus.publish('lead.captured', {}, { tenantId: 'tenant-1' });
    expect(count).toBe(1);
  });

  it('dispatches in-process RPC calls via local handlers', async () => {
    const client = new ModuleGatewayClient({
      sourceModule: 'communicator',
      tenantId: 'tenant-pk-1',
    });

    client.registerRpcHandler<{ sku: string }, { inStock: boolean; availableQuantity: number }>(
      'erp-1.check_inventory',
      (payload) => {
        return {
          inStock: payload.sku === 'LAWN-XL-1',
          availableQuantity: 42,
        };
      },
    );

    const res = await client.invokeRpc<
      { sku: string },
      { inStock: boolean; availableQuantity: number }
    >('erp-1', 'check_inventory', { sku: 'LAWN-XL-1' });

    expect(res.success).toBe(true);
    expect(res.data?.inStock).toBe(true);
    expect(res.data?.availableQuantity).toBe(42);
    expect(res.executionTimeMs).toBeGreaterThan(0);
  });
});
