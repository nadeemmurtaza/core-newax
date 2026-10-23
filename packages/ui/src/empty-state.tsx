import type { ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('nx-empty-state', className)}>
      <p className="nx-empty-state-title">{title}</p>
      {description ? <p className="nx-empty-state-description">{description}</p> : null}
      {action ? <div className="nx-empty-state-action">{action}</div> : null}
    </div>
  );
}
