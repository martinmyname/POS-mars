import React from 'react';
import { formatUGX } from '@/lib/formatUGX';
import { format } from 'date-fns';

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  originalPrice?: number;
  lineTotal: number;
}

export interface ReceiptData {
  orderId: string;
  createdAt: string;
  paymentMethod: string;
  items: ReceiptItem[];
  total: number;
  businessName?: string;
  address?: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  card: 'Card',
  qr: 'QR Payment',
  credit: 'Credit',
  deposit: 'Deposit',
};

export function Receipt({ data, onClose }: { data: ReceiptData; onClose?: () => void }) {
  const date = format(new Date(data.createdAt), 'dd MMM yyyy, HH:mm');
  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;

  const businessName = data.businessName ?? 'Mars Kitchen Essentials';
  const lines = [
    businessName,
    data.address ?? '',
    `Date: ${date}`,
    `Receipt #: ${data.orderId}`,
    `Payment: ${paymentLabel}`,
    '',
    ...data.items.map(
      (i) =>
        `${i.name} x${i.qty} @ ${formatUGX(i.unitPrice)} = ${formatUGX(i.lineTotal)}`
    ),
    '',
    `Total: ${formatUGX(data.total)}`,
    'Thank you for your purchase',
  ].filter(Boolean);

  const copyReceipt = () => {
    navigator.clipboard.writeText(lines.join('\n')).then(() => alert('Receipt copied. Paste into WhatsApp, SMS, or email.'));
  };
  const emailReceipt = () => {
    const subject = encodeURIComponent(`Receipt ${data.orderId}`);
    const body = encodeURIComponent(lines.join('\n'));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <div className="receipt-container">
      <div className="receipt-actions no-print flex-wrap gap-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-tufts-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Print receipt
        </button>
        <button type="button" onClick={copyReceipt} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Copy (SMS/WhatsApp)
        </button>
        <button type="button" onClick={emailReceipt} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Email receipt
        </button>
      </div>

      <div className="receipt-paper">
        <header className="receipt-header">
          <h1 className="receipt-business">{data.businessName ?? 'Mars Kitchen Essentials'}</h1>
          {data.address ? <p className="receipt-address">{data.address}</p> : null}
          <p className="receipt-tagline">Thank you for your purchase</p>
        </header>

        <div className="receipt-meta">
          <p>Date: {date}</p>
          <p>Receipt #: {data.orderId}</p>
          <p>Payment: {paymentLabel}</p>
        </div>

        <table className="receipt-table">
          <thead>
            <tr>
              <th className="text-left">Item</th>
              <th className="text-right">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, i) => (
              <tr key={i}>
                <td className="text-left">
                  <span className="font-medium">{item.name}</span>
                  {item.originalPrice != null && item.originalPrice > item.unitPrice && (
                    <div className="receipt-discount-line">
                      <span className="line-through text-slate-500">
                        {formatUGX(item.originalPrice)} × {item.qty}
                      </span>
                      <span className="text-green-700"> Discount applied</span>
                    </div>
                  )}
                </td>
                <td className="text-right">{item.qty}</td>
                <td className="text-right">
                  {item.originalPrice != null && item.originalPrice > item.unitPrice ? (
                    <span>
                      <span className="line-through text-slate-500">{formatUGX(item.originalPrice)}</span>
                      <span className="ml-1">{formatUGX(item.unitPrice)}</span>
                    </span>
                  ) : (
                    formatUGX(item.unitPrice)
                  )}
                </td>
                <td className="text-right font-medium">{formatUGX(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-total">
          <span>Total</span>
          <span className="font-bold">{formatUGX(data.total)}</span>
        </div>

        <footer className="receipt-footer">
          <p>Thank you for shopping with us</p>
        </footer>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-container, .receipt-container * { visibility: visible; }
          .receipt-container { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 0; }
          .no-print { display: none !important; }
          .receipt-paper { box-shadow: none; border: none; }
        }
        .receipt-actions { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .receipt-paper { max-width: 320px; margin: 0 auto; padding: 24px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .receipt-header { text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 12px; margin-bottom: 12px; }
        .receipt-business { font-size: 1.25rem; font-weight: 700; margin: 0; color: #100C08; }
        .receipt-address { font-size: 0.75rem; color: #64748b; margin: 4px 0 0; white-space: pre-line; }
        .receipt-tagline { font-size: 0.875rem; color: #64748b; margin: 4px 0 0; }
        .receipt-meta { font-size: 0.8125rem; color: #475569; margin-bottom: 16px; }
        .receipt-meta p { margin: 2px 0; }
        .receipt-table { width: 100%; font-size: 0.875rem; border-collapse: collapse; }
        .receipt-table th { padding: 6px 4px; color: #64748b; font-weight: 600; }
        .receipt-table td { padding: 6px 4px; border-top: 1px solid #f1f5f9; }
        .receipt-discount-line { font-size: 0.75rem; margin-top: 2px; }
        .receipt-total { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 2px solid #100C08; font-size: 1rem; }
        .receipt-footer { text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 0.875rem; color: #64748b; }
      `}</style>
    </div>
  );
}
