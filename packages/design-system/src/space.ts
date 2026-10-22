/** `8` -> `'0.5rem'`, for the CSS side. */
export function spaceRem(px: number): string {
  return `${px / 16}rem`;
}

/** Tailwind's spacing key for a px value on its 4px grid: `8` -> `'2'`, `2` -> `'0.5'`. */
export function tailwindSpacingKey(px: number): string {
  return String(px / 4);
}
