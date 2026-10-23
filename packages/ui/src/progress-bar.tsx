import { cn } from './cn';

export interface ProgressBarProps {
  readonly value: number;
  readonly max?: number;
  readonly label: string;
  readonly className?: string;
}

export function ProgressBar({ value, max = 100, label, className }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn('nx-progress-bar', className)}
    >
      <div className="nx-progress-bar-fill" style={{ width: `${(clamped / max) * 100}%` }} />
    </div>
  );
}
