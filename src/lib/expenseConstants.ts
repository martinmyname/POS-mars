export const EXPENSE_PURPOSE_OPTIONS = [
  'Stock',
  'Rent',
  'Branding',
  'Utility',
  'Marketing',
  'Advertising',
  'Furniture/display',
  'Delivery & operations',
  'Savings',
  'Labour',
  'Packaging',
  'other',
] as const;

export type ExpensePurpose = typeof EXPENSE_PURPOSE_OPTIONS[number];
