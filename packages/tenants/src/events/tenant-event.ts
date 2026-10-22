import type { TenantRecord } from '../types/tenant';

export interface TenantCreatedEvent {
  readonly name: 'tenant.created';
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly occurredAt: Date;
  readonly tenant: TenantRecord;
}

export type TenantEvent = TenantCreatedEvent;

export interface TenantEventPublisher {
  publish(event: TenantEvent): Promise<void>;
}
