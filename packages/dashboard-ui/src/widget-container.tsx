import type { ReactNode } from 'react';
import type { WidgetDefinition, WidgetRenderState } from '@newaxhq/dashboard-contracts';
import { cn } from '@newaxhq/ui';
import { presentWidgetState } from './widget-state';

const SIZE_CLASS: Record<WidgetDefinition['defaultSize'], string> = {
  sm: 'nx-widget-sm',
  md: 'nx-widget-md',
  lg: 'nx-widget-lg',
  xl: 'nx-widget-xl',
  full: 'nx-widget-full',
};

export interface WidgetContainerProps {
  readonly widget: WidgetDefinition;
  readonly size: WidgetDefinition['defaultSize'];
  readonly state: WidgetRenderState;
  readonly onRetry?: () => void;
  /** The widget's own content, rendered only when state.kind === 'ready'. */
  readonly children?: ReactNode;
}

/**
 * Structural shell around one widget: size, title, and the standard
 * non-ready states. The owning service's component supplies `children`
 * for the ready case; this container never fetches or interprets data.
 */
export function WidgetContainer({ widget, size, state, onRetry, children }: WidgetContainerProps) {
  const presentation = presentWidgetState(state);

  return (
    <section
      className={cn('nx-widget', SIZE_CLASS[size], presentation.className)}
      aria-label={widget.displayName}
    >
      <h3 className="nx-widget-title">{widget.displayName}</h3>
      {state.kind === 'ready' ? (
        children
      ) : state.kind === 'loading' ? (
        <div className="nx-widget-spinner" aria-hidden="true" />
      ) : (
        <div className="nx-widget-notice">
          <p className="nx-widget-notice-title">{presentation.title}</p>
          <p className="nx-widget-notice-message">{presentation.message}</p>
          {presentation.retryable && onRetry ? (
            <button type="button" className="nx-widget-retry" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
