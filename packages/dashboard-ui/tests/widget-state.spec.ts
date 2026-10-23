import { describe, expect, it } from 'vitest';
import { presentWidgetState } from '../src/widget-state';

describe('presentWidgetState', () => {
  it('maps loading with no title/message', () => {
    expect(presentWidgetState({ kind: 'loading' })).toEqual({
      className: 'nx-widget-loading',
      title: null,
      message: null,
      retryable: false,
    });
  });

  it('maps empty with its message', () => {
    expect(presentWidgetState({ kind: 'empty', message: 'No invoices yet.' })).toEqual({
      className: 'nx-widget-empty',
      title: 'Nothing here yet',
      message: 'No invoices yet.',
      retryable: false,
    });
  });

  it('maps access-denied with its reason', () => {
    expect(presentWidgetState({ kind: 'access-denied', reason: 'Missing invoices.read' })).toEqual({
      className: 'nx-widget-access-denied',
      title: 'Access unavailable',
      message: 'Missing invoices.read',
      retryable: false,
    });
  });

  it('maps a retryable error', () => {
    expect(presentWidgetState({ kind: 'error', message: 'Timed out.', retryable: true })).toEqual({
      className: 'nx-widget-error',
      title: 'Something went wrong',
      message: 'Timed out.',
      retryable: true,
    });
  });

  it('maps a non-retryable error', () => {
    const presentation = presentWidgetState({ kind: 'error', message: 'Gone.', retryable: false });
    expect(presentation.retryable).toBe(false);
  });
});
