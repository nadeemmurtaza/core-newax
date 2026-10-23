/**
 * core-newax's own web app brand VALUES, typed against its own
 * @nadeemmurtaza/design-system package (the engine this repo owns).
 *
 * Palette set to the one specified in NEWAX_IDENTITY_UI_UX_DESIGN_BRIEF_v1:
 * deep navy #0E1323, cyan accent #0097B2 -- shared with nID's login-ui
 * (same two colours, see that repo's brand.ts) so the identity screens
 * (nID) and the workspace screens (this app's /workspace routes) read as
 * one ecosystem, not two products. The marketing homepage at `/` keeps
 * using these same tokens too, rather than forking a second palette.
 */
import type { BrandTheme } from '@nadeemmurtaza/design-system';

export const THEME: BrandTheme = {
  colors: {
    neutral: {
      50: '#f4f6f8',
      100: '#e9eef3',
      200: '#cfd8df',
      300: '#4b5566',
      400: '#0e1323',
    },
    accent: { DEFAULT: '#0097b2', hover: '#007e95' },
    white: '#ffffff',
    surface: '#ffffff',
    overlay: '#ffffff',
    inverse: '#0e1323',
    onInverse: '#ffffff',
    scrim: '#0e1323',
    star: '#f5b841',
    feedback: { positive: '#0f7a4d', negative: '#b42318' },
    chart: ['#0097b2'],
  },
  colorsDark: {
    neutral: {
      50: '#0e1323',
      100: '#151b2e',
      200: '#293349',
      300: '#8a9aa6',
      400: '#eef1f4',
    },
    accent: { DEFAULT: '#0097b2', hover: '#17b4d1' },
    accentInk: { DEFAULT: '#3fc3de', hover: '#6fd4ea' },
    white: '#ffffff',
    surface: '#151b2e',
    overlay: '#151b2e',
    inverse: '#eef1f4',
    onInverse: '#0e1323',
    scrim: '#000000',
    star: '#f5b841',
    feedback: { positive: '#3dcb8b', negative: '#ff8a80' },
    chart: ['#3fc3de'],
  },
  radii: { sharp: 18, lg: 28, pill: 9999 },
  type: {
    micro: { size: 11, line: 16 },
    tiny: { size: 12, line: 16 },
    small: { size: 14, line: 20 },
    body: { size: 16, line: 25.6 },
    large: { size: 18, line: 28 },
    heading: { size: 20, line: 28 },
    title: { size: 24, line: 32 },
    display: { size: 30, line: 36 },
    metric: { size: 40, line: 44 },
  },
  fonts: {
    googleFont: 'Inter',
    displayStack: [
      'Inter',
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'sans-serif',
    ],
    sansStack: [
      'Inter',
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'sans-serif',
    ],
  },
  space: { 0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 24, 7: 32, 8: 48, 9: 64 },
  size: {
    control: { sm: 32, md: 40, lg: 48, xl: 56 },
    icon: { sm: 16, md: 20, lg: 24 },
    touch: { min: 44, pos: 48 },
  },
  elevation: {
    light: {
      flat: 'none',
      raised: '0 20px 50px rgb(14 26 36 / 8%)',
      overlay: '0 20px 50px rgb(14 26 36 / 8%)',
      modal: '0 20px 50px rgb(14 26 36 / 8%)',
    },
    dark: {
      flat: 'none',
      raised: '0 20px 50px rgb(0 0 0 / 30%)',
      overlay: '0 20px 50px rgb(0 0 0 / 40%)',
      modal: '0 20px 50px rgb(0 0 0 / 50%)',
    },
  },
  layers: { base: 0, sticky: 10, dropdown: 20, overlay: 30, modal: 40, toast: 50 },
  motion: {
    duration: { fast: 140, normal: 220 },
    easing: { standard: [0.2, 0, 0, 1] },
    distance: {},
    scale: {},
    stagger: { step: 0, fine: 0 },
    speed: { read: 0 },
  },
};
