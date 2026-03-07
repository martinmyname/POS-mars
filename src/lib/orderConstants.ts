import type { OrderChannel } from '@/types';

/**
 * Canonical channel options and labels. Use this in POS and Reports so labels never drift.
 * DB stores the value (e.g. 'physical'); display uses the label.
 */
export const CHANNEL_OPTIONS: { value: OrderChannel; label: string }[] = [
  { value: 'physical', label: 'Physical Store' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
];

/** Default order channel when creating a new order (e.g. in-store = physical). */
export const DEFAULT_ORDER_CHANNEL: OrderChannel = 'physical';

/** Get display label for a channel value. Falls back to the raw value if unknown. */
export function getChannelLabel(value: string): string {
  const option = CHANNEL_OPTIONS.find((o) => o.value === value);
  return option ? option.label : value;
}
