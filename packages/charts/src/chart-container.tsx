import type { ReactNode } from 'react';
import { cn } from '@newaxhq/ui';

export function ChartContainer({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <section className={cn('nx-chart-container', className)}>{children}</section>;
}

export function ChartHeader({ children }: { readonly children: ReactNode }) {
  return <header className="nx-chart-header">{children}</header>;
}

export function ChartTitle({ children }: { readonly children: ReactNode }) {
  return <h3 className="nx-chart-title">{children}</h3>;
}

export function ChartDescription({ children }: { readonly children: ReactNode }) {
  return <p className="nx-chart-description">{children}</p>;
}

export function ChartActions({ children }: { readonly children: ReactNode }) {
  return <div className="nx-chart-actions">{children}</div>;
}

export function ChartFooter({ children }: { readonly children: ReactNode }) {
  return <footer className="nx-chart-footer">{children}</footer>;
}

export function ChartSource({ children }: { readonly children: ReactNode }) {
  return <p className="nx-chart-source">{children}</p>;
}

/** The chart's plot area, sized via CSS so every chart type gets a
 * consistent, responsive default height instead of each one guessing. */
export function ChartPlot({ children }: { readonly children: ReactNode }) {
  return <div className="nx-chart-plot">{children}</div>;
}

export function ChartLoadingState() {
  return (
    <div className="nx-chart-loading" role="status" aria-busy="true">
      <span className="nx-chart-loading-spinner" aria-hidden="true" />
    </div>
  );
}

export function ChartErrorState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: () => void;
}) {
  return (
    <div className="nx-chart-error" role="alert">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function ChartEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="nx-chart-empty" role="status">
      <p>{message}</p>
    </div>
  );
}

/** Distinct from ChartEmptyState: the query/filters are valid, the
 * service genuinely has nothing for this period/segment -- as opposed to
 * "empty" meaning the feature has never been used at all. */
export function ChartNoDataState({
  message = 'No data for the selected range.',
}: {
  readonly message?: string;
}) {
  return (
    <div className="nx-chart-no-data" role="status">
      <p>{message}</p>
    </div>
  );
}
