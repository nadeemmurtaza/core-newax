import { cloneElement, isValidElement, useId, useState, type ReactElement } from 'react';
import { cn } from './cn';

export interface TooltipProps {
  readonly content: string;
  readonly children: ReactElement;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
  readonly className?: string;
}

/**
 * Wraps a single trigger element, wiring `aria-describedby` and the
 * show/hide handlers onto it rather than requiring the caller to do it --
 * a tooltip that only shows on hover and never reaches
 * keyboard/screen-reader users is not an accessible tooltip.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  if (!isValidElement(children)) {
    return children;
  }

  const trigger = cloneElement(children as ReactElement<Record<string, unknown>>, {
    'aria-describedby': id,
    onFocus: () => setVisible(true),
    onBlur: () => setVisible(false),
    onMouseEnter: () => setVisible(true),
    onMouseLeave: () => setVisible(false),
  });

  return (
    <span className="nx-tooltip-wrapper">
      {trigger}
      <span
        id={id}
        role="tooltip"
        data-side={side}
        className={cn(
          'nx-tooltip',
          visible ? 'nx-tooltip-visible' : 'nx-tooltip-hidden',
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
