/**
 * The shared shell's standard non-success states (brief section 4: "Standard
 * loading, error, empty, and access-denied states" / "CORE-SVC-09"-shaped
 * requirement applied to dashboard widgets, not just catalogue launch).
 * One vocabulary every widget/service renders through, instead of each
 * service inventing its own spinner/error copy.
 */
export type WidgetRenderState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'empty'; readonly message: string }
  | { readonly kind: 'access-denied'; readonly reason: string }
  | { readonly kind: 'error'; readonly message: string; readonly retryable: boolean };

export function isWidgetRenderState(value: unknown): value is WidgetRenderState {
  if (typeof value !== 'object' || value === null || !('kind' in value)) {
    return false;
  }
  const kind = (value as { kind: unknown }).kind;
  return (
    kind === 'loading' ||
    kind === 'ready' ||
    kind === 'empty' ||
    kind === 'access-denied' ||
    kind === 'error'
  );
}
