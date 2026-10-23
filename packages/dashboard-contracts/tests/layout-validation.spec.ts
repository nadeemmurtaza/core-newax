import { describe, expect, it } from 'vitest';
import { LAYOUT_SCHEMA_VERSION, type DashboardLayout } from '../src/types/layout';
import { validateDashboardLayout } from '../src/validation/layout-validation';

function validLayout(overrides: Partial<DashboardLayout> = {}): unknown {
  return {
    schemaVersion: LAYOUT_SCHEMA_VERSION,
    scope: { kind: 'user', accountId: 'acct_1', serviceId: 'communicator' },
    updatedAt: new Date().toISOString(),
    widgets: [
      {
        widgetId: 'recent-conversations',
        size: 'md',
        order: 0,
        config: { limit: 10, title: 'Recent' },
      },
    ],
    ...overrides,
  };
}

describe('validateDashboardLayout', () => {
  it('accepts a well-formed layout', () => {
    const result = validateDashboardLayout(validLayout());
    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('rejects a non-object value', () => {
    expect(validateDashboardLayout(null).valid).toBe(false);
    expect(validateDashboardLayout('not a layout').valid).toBe(false);
  });

  it('rejects an unsupported schema version', () => {
    const result = validateDashboardLayout(validLayout({ schemaVersion: 999 as never }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/schemaVersion/);
  });

  it('rejects a missing or invalid updatedAt', () => {
    expect(validateDashboardLayout(validLayout({ updatedAt: 'not-a-date' })).valid).toBe(false);
    expect(validateDashboardLayout(validLayout({ updatedAt: undefined as never })).valid).toBe(
      false,
    );
  });

  it('rejects widgets that are not an array', () => {
    const result = validateDashboardLayout(validLayout({ widgets: 'nope' as never }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/widgets/);
  });

  it('rejects an invalid widgetId', () => {
    const result = validateDashboardLayout(
      validLayout({
        widgets: [{ widgetId: 'Not Valid!', size: 'md', order: 0, config: {} }] as never,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/widgetId/);
  });

  it('rejects an invalid widget size', () => {
    const result = validateDashboardLayout(
      validLayout({
        widgets: [
          { widgetId: 'recent-conversations', size: 'huge', order: 0, config: {} },
        ] as never,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/size/);
  });

  it('rejects duplicate widget orders', () => {
    const result = validateDashboardLayout(
      validLayout({
        widgets: [
          { widgetId: 'recent-conversations', size: 'md', order: 0, config: {} },
          { widgetId: 'unread-count', size: 'sm', order: 0, config: {} },
        ] as never,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/order/);
  });

  it('rejects a widget config value of an unsupported type', () => {
    const result = validateDashboardLayout(
      validLayout({
        widgets: [
          {
            widgetId: 'recent-conversations',
            size: 'md',
            order: 0,
            config: { nested: { oops: true } },
          },
        ] as never,
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unsupported type/);
  });

  it('rejects an oversized widget list', () => {
    const widgets = Array.from({ length: 65 }, (_, i) => ({
      widgetId: 'recent-conversations',
      size: 'sm' as const,
      order: i,
      config: {},
    }));
    const result = validateDashboardLayout(validLayout({ widgets: widgets as never }));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Too many widgets/);
  });
});
