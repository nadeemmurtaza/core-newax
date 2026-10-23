import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
  readonly disabled?: boolean;
}

export interface TabsProps {
  readonly items: readonly TabItem[];
  readonly activeId: string;
  readonly onChange: (id: string) => void;
  readonly className?: string;
}

/** The ARIA tabs pattern: one tablist, each tab controlling exactly one
 * panel, panels for inactive tabs unmounted rather than hidden -- so an
 * inactive tab's content never fires effects or holds focusable elements
 * in the tab order. */
export function Tabs({ items, activeId, onChange, className }: TabsProps) {
  const baseId = useId();
  const activeItem = items.find((item) => item.id === activeId);

  return (
    <div className={cn('nx-tabs', className)}>
      <div role="tablist" className="nx-tabs-list">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${baseId}-panel-${item.id}`}
              disabled={item.disabled}
              tabIndex={active ? 0 : -1}
              className={cn('nx-tabs-tab', active && 'nx-tabs-tab-active')}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {activeItem ? (
        <div
          id={`${baseId}-panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${activeItem.id}`}
          className="nx-tabs-panel"
        >
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}
