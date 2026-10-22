import {
  type DomainEventEnvelope,
  type DomainEventHandler,
  type EventBusSubscription,
  type PublishEventOptions,
} from './types.js';

export class EventBus {
  private handlers = new Map<string, Set<DomainEventHandler>>();
  private offlineQueue: DomainEventEnvelope[] = [];

  public subscribe<T = Record<string, unknown>>(
    eventName: string,
    handler: DomainEventHandler<T>,
  ): EventBusSubscription {
    let set = this.handlers.get(eventName);
    if (!set) {
      set = new Set();
      this.handlers.set(eventName, set);
    }
    const genericHandler = handler as DomainEventHandler;
    set.add(genericHandler);

    return {
      eventName,
      handler: genericHandler,
      unsubscribe: () => {
        const currentSet = this.handlers.get(eventName);
        if (currentSet) {
          currentSet.delete(genericHandler);
          if (currentSet.size === 0) {
            this.handlers.delete(eventName);
          }
        }
      },
    };
  }

  public async publish<T = Record<string, unknown>>(
    eventName: string,
    payload: T,
    options: PublishEventOptions,
  ): Promise<{ status: 'dispatched' | 'queued_offline'; eventId: string }> {
    const eventId = `evt_${Date.now()}_${this.generateRandomHex(8)}`;
    const timestamp = new Date().toISOString();

    const envelope: DomainEventEnvelope<T> = {
      id: eventId,
      name: eventName,
      timestamp,
      tenantId: options.tenantId,
      ...(options.organizationId !== undefined ? { organizationId: options.organizationId } : {}),
      sourceModule: options.sourceModule || 'unknown',
      payload,
      ...(options.correlationId !== undefined ? { correlationId: options.correlationId } : {}),
    };

    // 1. Dispatch to local subscribers
    const exactHandlers = this.handlers.get(eventName);
    if (exactHandlers) {
      for (const handler of exactHandlers) {
        try {
          await handler(envelope as unknown as DomainEventEnvelope);
        } catch (err) {
          console.error(`[EventBus] Error in event handler for ${eventName}:`, err);
        }
      }
    }

    // Wildcard matching (e.g. "order.*")
    for (const [key, set] of this.handlers.entries()) {
      if (key.endsWith('.*')) {
        const prefix = key.slice(0, -2);
        if (eventName.startsWith(prefix) && key !== eventName) {
          for (const handler of set) {
            try {
              await handler(envelope as unknown as DomainEventEnvelope);
            } catch (err) {
              console.error(`[EventBus] Error in wildcard event handler for ${key}:`, err);
            }
          }
        }
      }
    }

    // 2. Dispatch to external relay if configured
    const relayUrl = options.relayUrl || process.env['RELAY_GATEWAY_URL'];
    if (relayUrl) {
      try {
        const resp = await fetch(relayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': options.tenantId,
          },
          body: JSON.stringify(envelope),
        });

        if (resp.ok) {
          return { status: 'dispatched', eventId };
        }
        this.offlineQueue.push(envelope as unknown as DomainEventEnvelope);
        return { status: 'queued_offline', eventId };
      } catch {
        this.offlineQueue.push(envelope as unknown as DomainEventEnvelope);
        return { status: 'queued_offline', eventId };
      }
    }

    return { status: 'dispatched', eventId };
  }

  public getQueuedOfflineEvents(): DomainEventEnvelope[] {
    return [...this.offlineQueue];
  }

  public clearQueuedOfflineEvents(): void {
    this.offlineQueue = [];
  }

  public unsubscribeAll(): void {
    this.handlers.clear();
  }

  private generateRandomHex(length = 8): string {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export const eventBus = new EventBus();
