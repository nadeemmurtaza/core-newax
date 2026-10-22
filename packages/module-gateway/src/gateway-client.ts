import {
  type GatewayClientConfig,
  type ModuleRpcRequest,
  type ModuleRpcResponse,
} from './types.js';

export type RpcHandler<TReq = unknown, TRes = unknown> = (
  payload: TReq,
  request: ModuleRpcRequest<TReq>,
) => Promise<TRes> | TRes;

export class ModuleGatewayClient {
  private config: GatewayClientConfig;
  private localRpcHandlers = new Map<string, RpcHandler>();

  constructor(config: GatewayClientConfig) {
    this.config = {
      sourceModule: config.sourceModule,
      tenantId: config.tenantId,
      ...(config.organizationId !== undefined ? { organizationId: config.organizationId } : {}),
      ...(config.gatewayUrl !== undefined
        ? { gatewayUrl: config.gatewayUrl.replace(/\/+$/, '') }
        : {}),
      allowOfflineFallback: config.allowOfflineFallback ?? true,
    };
  }

  public registerRpcHandler<TReq = unknown, TRes = unknown>(
    action: string,
    handler: RpcHandler<TReq, TRes>,
  ): void {
    this.localRpcHandlers.set(action, handler as RpcHandler);
  }

  public async invokeRpc<TReq = Record<string, unknown>, TRes = Record<string, unknown>>(
    targetModule: string,
    action: string,
    payload: TReq,
    options?: {
      tenantId?: string | undefined;
      organizationId?: string | null | undefined;
    },
  ): Promise<ModuleRpcResponse<TRes>> {
    const start = Date.now();
    const reqId = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const rpcRequest: ModuleRpcRequest<TReq> = {
      id: reqId,
      targetModule,
      action,
      tenantId: options?.tenantId || this.config.tenantId,
      ...(options?.organizationId !== undefined
        ? { organizationId: options.organizationId }
        : this.config.organizationId !== undefined
          ? { organizationId: this.config.organizationId }
          : {}),
      sourceModule: this.config.sourceModule,
      payload,
      timestamp: new Date().toISOString(),
    };

    // 1. Check if targetModule is local or handler is registered in-process
    const localHandler =
      this.localRpcHandlers.get(`${targetModule}.${action}`) || this.localRpcHandlers.get(action);
    if (localHandler) {
      try {
        const data = (await localHandler(
          payload,
          rpcRequest as unknown as ModuleRpcRequest,
        )) as TRes;
        return {
          id: reqId,
          success: true,
          data,
          executionTimeMs: Math.max(0.1, Date.now() - start),
        };
      } catch (err) {
        return {
          id: reqId,
          success: false,
          error: String(err),
          executionTimeMs: Math.max(0.1, Date.now() - start),
        };
      }
    }

    // 2. Dispatch via HTTP gateway
    const gatewayUrl = this.config.gatewayUrl || process.env['MODULE_GATEWAY_URL'];
    if (gatewayUrl) {
      try {
        const resp = await fetch(`${gatewayUrl}/api/v1/rpc/${targetModule}/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': rpcRequest.tenantId,
            'X-Source-Module': this.config.sourceModule,
          },
          body: JSON.stringify(rpcRequest),
        });

        const json = (await resp.json()) as { success?: boolean; data?: TRes; error?: string };
        return {
          id: reqId,
          success: resp.ok && (json.success ?? true),
          ...(json.data !== undefined ? { data: json.data } : {}),
          ...(json.error !== undefined
            ? { error: json.error }
            : !resp.ok
              ? { error: `Gateway returned status ${resp.status}` }
              : {}),
          executionTimeMs: Math.max(0.1, Date.now() - start),
        };
      } catch (err) {
        if (this.config.allowOfflineFallback) {
          return {
            id: reqId,
            success: false,
            error: `Gateway offline: ${String(err)}`,
            executionTimeMs: Math.max(0.1, Date.now() - start),
          };
        }
        throw err;
      }
    }

    return {
      id: reqId,
      success: false,
      error: `No local handler registered and no gateway URL configured for ${targetModule}.${action}`,
      executionTimeMs: Math.max(0.1, Date.now() - start),
    };
  }
}
