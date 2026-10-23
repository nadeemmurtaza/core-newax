import type { WidgetRenderState } from '@newaxhq/dashboard-contracts';

export interface WidgetStatePresentation {
  readonly className: string;
  readonly title: string | null;
  readonly message: string | null;
  readonly retryable: boolean;
}

/**
 * Maps a widget's render state to presentation, in one place, so every
 * widget across every service renders the same loading/empty/error
 * vocabulary instead of each one inventing its own copy and styling.
 */
export function presentWidgetState(state: WidgetRenderState): WidgetStatePresentation {
  switch (state.kind) {
    case 'loading':
      return { className: 'nx-widget-loading', title: null, message: null, retryable: false };
    case 'ready':
      return { className: 'nx-widget-ready', title: null, message: null, retryable: false };
    case 'empty':
      return {
        className: 'nx-widget-empty',
        title: 'Nothing here yet',
        message: state.message,
        retryable: false,
      };
    case 'access-denied':
      return {
        className: 'nx-widget-access-denied',
        title: 'Access unavailable',
        message: state.reason,
        retryable: false,
      };
    case 'error':
      return {
        className: 'nx-widget-error',
        title: 'Something went wrong',
        message: state.message,
        retryable: state.retryable,
      };
  }
}
