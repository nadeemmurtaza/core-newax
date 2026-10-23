/** Guards every caller against environments without `matchMedia` (SSR,
 * old browsers, test runners) instead of each component re-checking. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
