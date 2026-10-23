import { LAYOUT_SCHEMA_VERSION, type DashboardLayout, type PlacedWidget } from '../types/layout';
import { isValidWidgetId, isWidgetSize } from '../types/widget';

/**
 * Validates a layout read back from storage before the shell ever renders
 * it. A stored layout is attacker/corruption-influenceable input (brief:
 * "Validation of stored widget configuration" / "Recovery to a safe
 * default layout when a saved configuration is invalid") -- this never
 * throws; callers get a reason instead and fall back to the service
 * default, same pattern as CORE-SVC-09's launch-state resolution.
 */
export interface LayoutValidationResult {
  readonly valid: boolean;
  readonly reason: string | null;
}

const MAX_WIDGETS_PER_LAYOUT = 64;
const MAX_CONFIG_ENTRIES_PER_WIDGET = 32;
const MAX_CONFIG_KEY_LENGTH = 64;
const MAX_CONFIG_STRING_VALUE_LENGTH = 1024;

export function validateDashboardLayout(value: unknown): LayoutValidationResult {
  if (typeof value !== 'object' || value === null) {
    return { valid: false, reason: 'Layout is not an object.' };
  }
  const layout = value as Partial<DashboardLayout>;

  if (layout.schemaVersion !== LAYOUT_SCHEMA_VERSION) {
    return { valid: false, reason: `Unsupported schemaVersion: ${String(layout.schemaVersion)}.` };
  }
  if (typeof layout.updatedAt !== 'string' || Number.isNaN(Date.parse(layout.updatedAt))) {
    return { valid: false, reason: 'updatedAt is missing or not a valid ISO timestamp.' };
  }
  if (!Array.isArray(layout.widgets)) {
    return { valid: false, reason: 'widgets is not an array.' };
  }
  if (layout.widgets.length > MAX_WIDGETS_PER_LAYOUT) {
    return { valid: false, reason: `Too many widgets (max ${MAX_WIDGETS_PER_LAYOUT}).` };
  }

  const seenOrders = new Set<number>();
  for (const widget of layout.widgets) {
    const result = validatePlacedWidget(widget);
    if (!result.valid) {
      return result;
    }
    const order = (widget as PlacedWidget).order;
    if (seenOrders.has(order)) {
      return { valid: false, reason: `Duplicate widget order: ${order}.` };
    }
    seenOrders.add(order);
  }

  return { valid: true, reason: null };
}

function validatePlacedWidget(value: unknown): LayoutValidationResult {
  if (typeof value !== 'object' || value === null) {
    return { valid: false, reason: 'A widget entry is not an object.' };
  }
  const widget = value as Partial<PlacedWidget>;

  if (!isValidWidgetId(widget.widgetId)) {
    return { valid: false, reason: `Invalid widgetId: ${String(widget.widgetId)}.` };
  }
  if (!isWidgetSize(widget.size)) {
    return { valid: false, reason: `Invalid widget size: ${String(widget.size)}.` };
  }
  if (typeof widget.order !== 'number' || !Number.isInteger(widget.order) || widget.order < 0) {
    return { valid: false, reason: `Invalid widget order: ${String(widget.order)}.` };
  }
  if (typeof widget.config !== 'object' || widget.config === null) {
    return { valid: false, reason: 'Widget config is not an object.' };
  }
  const entries = Object.entries(widget.config);
  if (entries.length > MAX_CONFIG_ENTRIES_PER_WIDGET) {
    return { valid: false, reason: 'Widget config has too many entries.' };
  }
  for (const [key, entryValue] of entries) {
    if (key.length > MAX_CONFIG_KEY_LENGTH) {
      return { valid: false, reason: `Widget config key too long: ${key}.` };
    }
    const type = typeof entryValue;
    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      return { valid: false, reason: `Widget config value for "${key}" has an unsupported type.` };
    }
    if (type === 'string' && (entryValue as string).length > MAX_CONFIG_STRING_VALUE_LENGTH) {
      return { valid: false, reason: `Widget config value for "${key}" is too long.` };
    }
  }

  return { valid: true, reason: null };
}
