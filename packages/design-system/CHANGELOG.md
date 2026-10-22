# @newax/design-system

## 0.1.0

Initial extraction from erp-1's `packages/shared/src/theme-*.ts`. Carries
the brand-agnostic design-token engine -- colour maths, type/space/size/
motion scale builders, the Tailwind theme builder (`createThemeTailwind`),
WCAG contrast functions, and the theme-preference runtime -- plus the
`BrandTheme` type contract every product's own `brand.ts` must satisfy.

No brand values moved. Each product keeps its own `brand.ts`.
