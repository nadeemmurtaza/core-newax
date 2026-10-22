export interface FileRegisteredEvent {
  readonly name: 'file.registered';
  readonly actorUserId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly fileId: string;
  readonly occurredAt: Date;
}

export type FileEvent = FileRegisteredEvent;

export interface FileEventPublisher {
  publish(event: FileEvent): Promise<void>;
}
