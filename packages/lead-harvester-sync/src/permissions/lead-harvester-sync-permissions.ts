export const LEAD_HARVESTER_SYNC_PERMISSIONS = {
  ingest: 'lead_harvester_sync.ingest',
} as const;

export type LeadHarvesterSyncPermission =
  (typeof LEAD_HARVESTER_SYNC_PERMISSIONS)[keyof typeof LEAD_HARVESTER_SYNC_PERMISSIONS];
