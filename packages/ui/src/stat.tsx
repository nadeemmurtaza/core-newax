import { cn } from './cn';

export interface StatProps {
  readonly label: string;
  readonly value: string;
  readonly trend?: { readonly direction: 'up' | 'down' | 'flat'; readonly label: string };
  readonly className?: string;
}

export function Stat({ label, value, trend, className }: StatProps) {
  return (
    <div className={cn('nx-stat', className)}>
      <p className="nx-stat-label">{label}</p>
      <p className="nx-stat-value">{value}</p>
      {trend ? (
        <p className={cn('nx-stat-trend', `nx-stat-trend-${trend.direction}`)}>{trend.label}</p>
      ) : null}
    </div>
  );
}
