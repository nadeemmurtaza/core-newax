export interface DomainEventEnvelope<T = Record<string, unknown>> {
  id: string;
  name: string;
  timestamp: string;
  tenantId: string;
  organizationId?: string | null | undefined;
  sourceModule: string;
  payload: T;
  correlationId?: string | undefined;
}

export interface PublishEventOptions {
  tenantId: string;
  organizationId?: string | null | undefined;
  sourceModule?: string | undefined;
  correlationId?: string | undefined;
  relayUrl?: string | undefined;
}

export type DomainEventHandler<T = Record<string, unknown>> = (
  event: DomainEventEnvelope<T>,
) => Promise<void> | void;

export interface EventBusSubscription {
  eventName: string;
  handler: DomainEventHandler;
  unsubscribe: () => void;
}

export interface ModuleRpcRequest<T = Record<string, unknown>> {
  id: string;
  targetModule: string;
  action: string;
  tenantId: string;
  organizationId?: string | null | undefined;
  sourceModule: string;
  payload: T;
  timestamp: string;
}

export interface ModuleRpcResponse<T = Record<string, unknown>> {
  id: string;
  success: boolean;
  data?: T | undefined;
  error?: string | undefined;
  executionTimeMs: number;
}

export interface GatewayClientConfig {
  gatewayUrl?: string | undefined;
  sourceModule: string;
  tenantId: string;
  organizationId?: string | null | undefined;
  allowOfflineFallback?: boolean | undefined;
}
