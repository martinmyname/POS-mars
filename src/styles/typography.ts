// src/styles/typography.ts
// Apple type system — single source of truth for all type decisions.

export const fontFamilies = {
  // SF Pro — for all UI, body, labels, nav, inputs, buttons
  sans:
    '-apple-system, "SF Pro Text", "SF Pro Display", BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',

  // New York — for display headings and editorial moments only
  serif: '"New York", "Georgia", ui-serif, serif',

  // SF Mono — for code, prices, numeric data, IDs
  mono: '"SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
} as const;

export const fontSizes = {
  xs: '11px',
  sm: '12px',
  base: '14px',
  md: '15px',
  lg: '17px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  '4xl': '34px',
  '5xl': '48px',
} as const;

export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
} as const;

export const lineHeights = {
  tight: 1.2,
  snug: 1.35,
  normal: 1.5,
  relaxed: 1.65,
} as const;

export const letterSpacings = {
  tighter: '-0.02em',
  tight: '-0.01em',
  normal: '0',
  wide: '0.04em',
  wider: '0.08em',
} as const;

export const textStyles = {
  heroTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes['5xl'],
    fontWeight: fontWeights.heavy,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacings.tighter,
  },
  pageTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacings.tight,
  },
  sectionTitle: {
    fontFamily: fontFamilies.serif,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacings.tight,
  },
  cardTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
    letterSpacing: letterSpacings.normal,
  },
  modalTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.snug,
  },
  navItem: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
  },
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
  },
  bodyMd: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
  },
  bodySmall: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
  },
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacings.wider,
    textTransform: 'uppercase' as const,
    lineHeight: lineHeights.normal,
  },
  caption: {
    fontFamily: fontFamilies.sans,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.regular,
    lineHeight: lineHeights.normal,
  },
  money: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: lineHeights.normal,
    letterSpacing: letterSpacings.tight,
  },
  moneyLarge: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
    letterSpacing: letterSpacings.tighter,
  },
  tableNum: {
    fontFamily: fontFamilies.mono,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.regular,
  },
} as const;
