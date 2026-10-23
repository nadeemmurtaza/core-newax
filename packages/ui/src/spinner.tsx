import { cn } from './cn';

export interface SpinnerProps {
  readonly label?: string;
  readonly className?: string;
}

export function Spinner({ label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" className={cn('nx-spinner', className)}>
      <span className="nx-visually-hidden">{label}</span>
    </span>
  );
}
