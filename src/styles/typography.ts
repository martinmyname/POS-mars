// src/styles/typography.ts
// Apple typography — single source of truth for semantic text styles.
// Use for inline styles; prefer Tailwind classes (font-sans, text-body, etc.) where possible.

export const fontFamilies = {
  sans:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: '"New York", ui-serif, Georgia, "Times New Roman", serif',
  mono: '"SF Mono", ui-monospace, "Cascadia Code", "Fira Code", Menlo, Monaco, Consolas, monospace',
} as const;

// Apple HIG text styles — adapted for web (px, not pt)
export const appleTextStyles = {
  hero: {
    fontFamily: fontFamilies.serif,
    fontSize: '48px',
    fontWeight: 700,
    lineHeight: 1.14,
    letterSpacing: '-0.003em',
  },
  largeTitle: {
    fontFamily: fontFamilies.sans,
    fontSize: '34px',
    fontWeight: 700,
    lineHeight: 1.21,
    letterSpacing: '0.0037em',
  },
  title1: {
    fontFamily: fontFamilies.sans,
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: 1.32,
    letterSpacing: '0.0013em',
  },
  title2: {
    fontFamily: fontFamilies.sans,
    fontSize: '22px',
    fontWeight: 700,
    lineHeight: 1.36,
    letterSpacing: '0.0016em',
  },
  title3: {
    fontFamily: fontFamilies.sans,
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: '0.0038em',
  },
  headline: {
    fontFamily: fontFamilies.sans,
    fontSize: '17px',
    fontWeight: 600,
    lineHeight: 1.47,
    letterSpacing: '-0.0043em',
  },
  body: {
    fontFamily: fontFamilies.sans,
    fontSize: '17px',
    fontWeight: 400,
    lineHeight: 1.47,
    letterSpacing: '-0.0043em',
  },
  callout: {
    fontFamily: fontFamilies.sans,
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.375,
    letterSpacing: '-0.0031em',
  },
  subhead: {
    fontFamily: fontFamilies.sans,
    fontSize: '15px',
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: '-0.0024em',
  },
  footnote: {
    fontFamily: fontFamilies.sans,
    fontSize: '13px',
    fontWeight: 400,
    lineHeight: 1.38,
    letterSpacing: '-0.0008em',
  },
  caption1: {
    fontFamily: fontFamilies.sans,
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.33,
    letterSpacing: '0',
  },
  caption2: {
    fontFamily: fontFamilies.sans,
    fontSize: '11px',
    fontWeight: 400,
    lineHeight: 1.36,
    letterSpacing: '0.066em',
  },
  label: {
    fontFamily: fontFamilies.sans,
    fontSize: '11px',
    fontWeight: 600,
    lineHeight: 1.36,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
  },
  moneyLarge: {
    fontFamily: fontFamilies.mono,
    fontSize: '28px',
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  moneyMedium: {
    fontFamily: fontFamilies.mono,
    fontSize: '20px',
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
    fontVariantNumeric: 'tabular-nums',
  },
  moneyBody: {
    fontFamily: fontFamilies.mono,
    fontSize: '17px',
    fontWeight: 400,
    lineHeight: 1.47,
    letterSpacing: '-0.0043em',
    fontVariantNumeric: 'tabular-nums',
  },
  moneySmall: {
    fontFamily: fontFamilies.mono,
    fontSize: '13px',
    fontWeight: 400,
    lineHeight: 1.38,
    fontVariantNumeric: 'tabular-nums',
  },
} as const;
