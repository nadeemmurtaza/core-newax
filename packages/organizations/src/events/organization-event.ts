import type { OrganizationRecord } from '../types/organization';

export type OrganizationEventName =
  'organization.archived' | 'organization.created' | 'organization.updated';

export interface OrganizationEvent {
  readonly name: OrganizationEventName;
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly occurredAt: Date;
  readonly organization: OrganizationRecord;
}

export interface OrganizationEventPublisher {
  publish(event: OrganizationEvent): Promise<void>;
}
