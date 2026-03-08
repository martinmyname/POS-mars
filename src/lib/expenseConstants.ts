export const EXPENSE_PURPOSE_OPTIONS = [
  'Stock',
  'Rent',
  'Labour',
  'Utility',
  'Marketing',
  'Advertising',
  'Maintenance',
  'Packaging',
  'Branding',
  'Furniture/display',
  'Delivery & operations',
  'Savings',
  'Content creation',
  'Ecommerce maintenance',
  'Cleaning',
] as const;

export type ExpensePurpose = (typeof EXPENSE_PURPOSE_OPTIONS)[number];

/** Display-only label for legacy expenses with unknown/empty purpose (not selectable for new expenses). */
export const UNCATEGORIZED_LABEL = 'Uncategorized';

/** Purposes treated as RESTOCK — shown separately, never deducted from net profit */
export const RESTOCK_PURPOSES: readonly ExpensePurpose[] = ['Stock'];

/** Purposes treated as FIXED COSTS for break-even calculation */
export const FIXED_COST_PURPOSES: readonly string[] = [
  'Rent',
  'Labour',
  'Utility',
  'Utilities',
  'Maintenance',
];

/** Color per purpose — used in breakdown bars, dots, and pills */
export const PURPOSE_COLORS: Record<string, string> = {
  Stock: '#e85d04',
  Rent: '#6a4c93',
  Labour: '#1982c4',
  Utility: '#8ac926',
  Marketing: '#ff595e',
  Advertising: '#ff924c',
  Maintenance: '#6c757d',
  Packaging: '#20bf55',
  Branding: '#a855f7',
  'Furniture/display': '#06d6a0',
  'Delivery & operations': '#118ab2',
  Savings: '#c4a000',
  'Content creation': '#e63946',
  'Ecommerce maintenance': '#457b9d',
  Cleaning: '#1d3557',
  [UNCATEGORIZED_LABEL]: '#adb5bd',
};
