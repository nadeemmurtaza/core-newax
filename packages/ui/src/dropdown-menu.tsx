import type { ReactNode } from 'react';
import { cn } from './cn';

export interface DropdownMenuItem {
  readonly id: string;
  readonly label: string;
  readonly onSelect?: () => void;
  readonly href?: string;
  readonly destructive?: boolean;
  readonly disabled?: boolean;
}

export interface DropdownMenuProps {
  readonly trigger: ReactNode;
  readonly items: readonly DropdownMenuItem[];
  readonly className?: string;
}

export function DropdownMenu({ trigger, items, className }: DropdownMenuProps) {
  return (
    <details className={cn('nx-dropdown-menu', className)}>
      <summary className="nx-dropdown-menu-trigger">{trigger}</summary>
      <ul className="nx-dropdown-menu-list" role="menu">
        {items.map((item) => (
          <li key={item.id} role="none">
            {item.href ? (
              <a
                href={item.href}
                role="menuitem"
                aria-disabled={item.disabled}
                className={cn(
                  'nx-dropdown-menu-item',
                  item.destructive && 'nx-dropdown-menu-item-destructive',
                )}
              >
                {item.label}
              </a>
            ) : (
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={item.onSelect}
                className={cn(
                  'nx-dropdown-menu-item',
                  item.destructive && 'nx-dropdown-menu-item-destructive',
                )}
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
