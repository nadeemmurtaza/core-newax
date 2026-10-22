# @newax/design-system

The one place the NEWAX ecosystem's design-token _engine_ lives. It knows
the shape of a brand's theme (`BrandTheme`, in `src/types.ts`) and how to
derive everything mechanical from it -- CSS custom properties, a Tailwind
`theme` object, WCAG contrast checks, a type scale in Tailwind's units, a
pre-paint theme-resolution script. It does **not** know any product's actual
colours, radii, or copy -- that stays in each product's own `brand.ts`,
which must satisfy `BrandTheme`.

## Why a separate package

Colour, radius, type scale, spacing and motion used to be forked per
product (erp-1 had its own copy in `packages/shared`; the next product
would have started its own). This package is the fix: the _engine_ is
written once, here, and every product's `brand.ts` is just data plugged
into it.

## Using it

```ts
// your-app/packages/shared/src/brand.ts
import type { BrandTheme } from '@newax/design-system';

const theme: BrandTheme = {
  colors: {/* your palette */},
  colorsDark: {/* ... */},
  radii: { sharp: 2, lg: 3, pill: 9999 },
  // ...
};

export const BRAND = { identity: {/* ... */}, theme /* , ... */ } as const;
```

```ts
// your-app's own thin view, same name every product has used for years
import { BRAND } from './brand';
export const THEME_COLORS = BRAND.theme.colors;
```

```ts
// your-app/tailwind.config.ts
import { createThemeTailwind } from '@newax/design-system';
import { BRAND } from './packages/shared/src/brand';
import { stockHues } from './stock-hues'; // the 4 Tailwind scales you use

const t = createThemeTailwind(BRAND.theme, stockHues);
// t.colors, t.backgroundColor, t.boxShadow, t.baseStyles(), ...
```

## What's in here

| Module                                                    | Purpose                                                                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `types.ts`                                                | `BrandTheme` and its constituent interfaces -- the contract                                                    |
| `color.ts`                                                | hex/rgb maths, dark-hue derivation, stock-hue scale types                                                      |
| `contrast.ts`                                             | WCAG 2.x relative luminance / contrast ratio / level                                                           |
| `radii.ts`, `space.ts`, `motion.ts`, `type.ts`, `size.ts` | small pure derivations (px<->rem, cubic-bezier strings, Tailwind font-size table, control-size spacing keys)   |
| `tailwind.ts`                                             | `createThemeTailwind(brand, stock)` -- the full Tailwind `theme` object, CSS custom properties, `baseStyles()` |
| `runtime.ts`                                              | theme-preference resolution and the pre-paint inline script                                                    |

## What's deliberately NOT in here

- Brand values (colours, copy, contact info, locale) -- each product's own
  `brand.ts`.
- A Tailwind dependency -- this package returns plain data so React Native
  and non-Tailwind consumers can use it too.
- Anything product-specific (erp-1's `pricing.ts`, `sku.ts`, etc. stay in
  erp-1's own `packages/shared`).
