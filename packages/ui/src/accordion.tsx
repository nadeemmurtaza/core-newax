import type { ReactNode } from 'react';
import { cn } from './cn';

export interface AccordionItem {
  readonly id: string;
  readonly title: string;
  readonly content: ReactNode;
}

export interface AccordionProps {
  readonly items: readonly AccordionItem[];
  readonly className?: string;
}

/** Built on <details>/<summary> -- each item opens/closes independently
 * (not an accordion that force-closes siblings), with native keyboard
 * and screen-reader support for free. */
export function Accordion({ items, className }: AccordionProps) {
  return (
    <div className={cn('nx-accordion', className)}>
      {items.map((item) => (
        <details key={item.id} className="nx-accordion-item">
          <summary className="nx-accordion-trigger">{item.title}</summary>
          <div className="nx-accordion-content">{item.content}</div>
        </details>
      ))}
    </div>
  );
}

export interface CollapsibleProps {
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string;
}

/** A single collapsible section -- Accordion is a list of these sharing
 * one container; use Collapsible directly for just one. */
export function Collapsible({ label, children, className }: CollapsibleProps) {
  return (
    <details className={cn('nx-collapsible', className)}>
      <summary className="nx-collapsible-trigger">{label}</summary>
      <div className="nx-collapsible-content">{children}</div>
    </details>
  );
}
