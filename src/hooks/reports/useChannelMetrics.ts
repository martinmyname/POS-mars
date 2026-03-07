import { useMemo } from 'react';

interface OrderLike {
  channel?: string;
  total?: number;
}

export interface ChannelRow {
  channel: string;
  count: number;
  revenue: number;
}

export function useChannelMetrics(periodOrders: OrderLike[]): ChannelRow[] {
  return useMemo(() => {
    const channelMap = new Map<string, { channel: string; count: number; revenue: number }>();
    periodOrders.forEach((order) => {
      const channel = order.channel || 'physical';
      const existing = channelMap.get(channel) || { channel, count: 0, revenue: 0 };
      existing.count += 1;
      existing.revenue += Number(order.total) || 0;
      channelMap.set(channel, existing);
    });
    return Array.from(channelMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [periodOrders]);
}
