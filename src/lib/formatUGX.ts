/**
 * Format numbers as UGX (Uganda Shillings) for display.
 */
const ugxFormatter = new Intl.NumberFormat('en-UG', {
  style: 'currency',
  currency: 'UGX',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatUGX(value: number): string {
  return ugxFormatter.format(value);
}
