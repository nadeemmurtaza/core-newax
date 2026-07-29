export interface LeadHarvesterInstitutionSyncedEvent {
  readonly name: 'lead_harvester_sync.institution_synced';
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly sourceEventId: string;
  readonly skippedCount: number;
  readonly occurredAt: Date;
}

export type LeadHarvesterSyncEvent = LeadHarvesterInstitutionSyncedEvent;

export interface LeadHarvesterSyncEventPublisher {
  publish(event: LeadHarvesterSyncEvent): Promise<void>;
}
