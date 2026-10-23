import { cn } from './cn';
import { Button } from './button';

export interface ErrorStateProps {
  readonly title?: string;
  readonly message: string;
  readonly onRetry?: () => void;
  readonly className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn('nx-error-state', className)}>
      <p className="nx-error-state-title">{title}</p>
      <p className="nx-error-state-message">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}
