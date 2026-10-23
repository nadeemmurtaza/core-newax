import { useEffect, useRef } from 'react';
import { cn } from '@newaxhq/ui';
import { isNavItemActive } from './active-route';
import type { NavItem } from './types';

export interface MobileNavDrawerProps {
  readonly items: readonly NavItem[];
  readonly currentPath: string;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly label: string;
  readonly className?: string;
}

/**
 * The mobile nav drawer. Built on <dialog> rather than a hand-rolled
 * overlay: the browser gives focus trapping, Escape-to-close, and
 * backdrop semantics for free, which is exactly the "correct keyboard
 * navigation and focus management" requirement a custom implementation
 * tends to get wrong.
 */
export function MobileNavDrawer({
  items,
  currentPath,
  open,
  onClose,
  label,
  className,
}: MobileNavDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={cn('nx-mobile-nav-drawer', className)}
      aria-label={label}
      onClose={onClose}
      onCancel={onClose}
    >
      <button
        type="button"
        className="nx-mobile-nav-drawer-close"
        onClick={onClose}
        aria-label="Close menu"
      >
        ×
      </button>
      <ul className="nx-mobile-nav-drawer-list">
        {items.map((item) => {
          const active = isNavItemActive(item.href, currentPath);
          return (
            <li key={item.id}>
              <a
                href={item.href}
                className={cn(
                  'nx-mobile-nav-drawer-link',
                  active && 'nx-mobile-nav-drawer-link-active',
                )}
                aria-current={active ? 'page' : undefined}
                onClick={onClose}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
