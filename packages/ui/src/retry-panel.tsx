import { cn } from './cn';
import { Spinner } from './spinner';
import { Button } from './button';

export interface RetryPanelProps {
  readonly message: string;
  /** True while an automatic retry is in flight -- distinct from
   * ErrorState, which is for a failure with no retry attempted yet. */
  readonly retrying: boolean;
  readonly attempt?: number;
  readonly onRetryNow: () => void;
  readonly className?: string;
}

export function RetryPanel({ message, retrying, attempt, onRetryNow, className }: RetryPanelProps) {
  return (
    <div role="status" className={cn('nx-retry-panel', className)}>
      <p className="nx-retry-panel-message">{message}</p>
      {retrying ? (
        <div className="nx-retry-panel-status">
          <Spinner label="Retrying" />
          {attempt !== undefined ? <span>Attempt {attempt}</span> : null}
        </div>
      ) : (
        <Button variant="secondary" onClick={onRetryNow}>
          Retry now
        </Button>
      )}
    </div>
  );
}
