import {
  isValidWidgetId,
  type WidgetDefinition,
  type WidgetId,
} from '@newaxhq/dashboard-contracts';

/**
 * In-memory registry of widgets Core knows about. Registration happens at
 * service-bootstrap time (trusted, server-side) -- that is why duplicate
 * or malformed registrations throw here, unlike layout validation, which
 * must never throw at render time.
 */
export class WidgetRegistry {
  private readonly widgets = new Map<WidgetId, WidgetDefinition>();

  register(widget: WidgetDefinition): void {
    if (!isValidWidgetId(widget.id)) {
      throw new Error(`Invalid widget id: ${widget.id}`);
    }
    const existing = this.widgets.get(widget.id);
    if (existing && existing.ownerServiceId !== widget.ownerServiceId) {
      throw new Error(
        `Widget id "${widget.id}" is already registered by service "${existing.ownerServiceId}"`,
      );
    }
    this.widgets.set(widget.id, widget);
  }

  get(id: WidgetId): WidgetDefinition | undefined {
    return this.widgets.get(id);
  }

  listByService(ownerServiceId: string): readonly WidgetDefinition[] {
    return [...this.widgets.values()].filter((widget) => widget.ownerServiceId === ownerServiceId);
  }

  list(): readonly WidgetDefinition[] {
    return [...this.widgets.values()];
  }

  clear(): void {
    this.widgets.clear();
  }
}
