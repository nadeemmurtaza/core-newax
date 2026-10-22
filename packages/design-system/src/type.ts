import type { ThemeType, TypeStep } from './types';

function rem(step: TypeStep): [string, { lineHeight: string }] {
  return [`${step.size / 16}rem`, { lineHeight: `${step.line / 16}rem` }];
}

/** The scale keyed by Tailwind's utility names, ready for `theme.fontSize`. */
export function buildTailwindFontSize(type: ThemeType) {
  return {
    '2xs': rem(type.micro),
    xs: rem(type.tiny),
    sm: rem(type.small),
    base: rem(type.body),
    lg: rem(type.large),
    xl: rem(type.heading),
    '2xl': rem(type.title),
    '3xl': rem(type.display),
    metric: rem(type.metric),
  } as const;
}
