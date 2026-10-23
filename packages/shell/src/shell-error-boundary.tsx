import { Component, type ReactNode } from 'react';
import { cn } from '@newaxhq/ui';

export interface ShellErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: (error: Error, reset: () => void) => ReactNode;
  readonly onError?: (error: Error) => void;
  readonly className?: string;
}

interface ShellErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * The app-wide fallback for a render crash the shell didn't cause -- a
 * widget, a page, anything inside AppShell's children. React error
 * boundaries must be class components; there's no hook equivalent.
 * Scoped narrowly (wrap `children` in AppShell, not the whole app), so a
 * header/nav bug isn't swallowed by the same boundary.
 */
export class ShellErrorBoundary extends Component<
  ShellErrorBoundaryProps,
  ShellErrorBoundaryState
> {
  override state: ShellErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ShellErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className={cn('nx-shell-error-boundary', this.props.className)} role="alert">
        <p className="nx-shell-error-title">Something went wrong</p>
        <p className="nx-shell-error-message">{error.message}</p>
        <button type="button" className="nx-shell-error-retry" onClick={this.reset}>
          Retry
        </button>
      </div>
    );
  }
}
