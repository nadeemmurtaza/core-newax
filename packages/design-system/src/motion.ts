/** `[0.2, 0, 0, 1]` -> `'cubic-bezier(0.2, 0, 0, 1)'`, for CSS. */
export function cubicBezier(points: readonly number[]): string {
  return `cubic-bezier(${points.join(', ')})`;
}

/** `220` -> `'220ms'`, for CSS. */
export function ms(value: number): string {
  return `${value}ms`;
}
