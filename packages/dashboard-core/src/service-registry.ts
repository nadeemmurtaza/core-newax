import {
  isValidServiceId,
  type ServiceId,
  type ServiceRegistration,
} from '@newaxhq/dashboard-contracts';

export class ServiceRegistry {
  private readonly services = new Map<ServiceId, ServiceRegistration>();

  register(service: ServiceRegistration): void {
    if (!isValidServiceId(service.id)) {
      throw new Error(`Invalid service id: ${service.id}`);
    }
    if (this.services.has(service.id)) {
      throw new Error(`Service "${service.id}" is already registered`);
    }
    this.services.set(service.id, service);
  }

  get(id: ServiceId): ServiceRegistration | undefined {
    return this.services.get(id);
  }

  list(): readonly ServiceRegistration[] {
    return [...this.services.values()];
  }

  /** Services visible given the caller's granted permissions -- a null
   * discoveryPermission means visible to anyone with access to Core itself. */
  listDiscoverable(grantedPermissions: ReadonlySet<string>): readonly ServiceRegistration[] {
    return this.list().filter(
      (service) =>
        service.discoveryPermission === null || grantedPermissions.has(service.discoveryPermission),
    );
  }

  clear(): void {
    this.services.clear();
  }
}
