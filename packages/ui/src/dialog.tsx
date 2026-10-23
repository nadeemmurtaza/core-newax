import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface DialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
}

/** Native `<dialog>` for free focus-trap/Escape/backdrop -- same choice
 * as @newaxhq/shell's MobileNavDrawer, kept here too since a plain
 * content dialog is a UI primitive, not a navigation concern. */
export function Dialog({ open, onClose, title, children, footer, className }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
      className={cn('nx-dialog', className)}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
    >
      <h2 id={titleId} className="nx-dialog-title">
        {title}
      </h2>
      <div className="nx-dialog-body">{children}</div>
      {footer ? <div className="nx-dialog-footer">{footer}</div> : null}
    </dialog>
  );
}
