import { formatUGX } from '@/lib/formatUGX';
import { format } from 'date-fns';
import { User, Phone, MapPin, Calendar, Receipt as ReceiptIcon, CreditCard } from 'lucide-react';

export interface ReceiptItem {
  name: string;
  qty: number;
  unitPrice: number;
  originalPrice?: number;
  lineTotal: number;
}

export interface ReceiptData {
  orderId: string;
  /** Human-friendly order number for display (e.g. 1001). Shown as "Receipt #1001". */
  orderNumber?: number;
  createdAt: string;
  paymentMethod: string;
  paymentCode?: string;
  items: ReceiptItem[];
  total: number;
  businessName?: string;
  address?: string;
  /** Call / WhatsApp */
  businessPhone?: string;
  businessEmail?: string;
  customerName?: string;
  customerPhone?: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  mtn_momo: 'MTN MoMo',
  airtel_pay: 'Airtel Pay',
};

export function Receipt({ data, onClose }: { data: ReceiptData; onClose?: () => void }) {
  const date = format(new Date(data.createdAt), 'dd MMM yyyy');
  const time = format(new Date(data.createdAt), 'HH:mm');
  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;

  const businessName = data.businessName ?? 'Mars Kitchen Essentials';
  const receiptNumber = data.orderNumber != null ? String(data.orderNumber) : data.orderId;
  const paymentLine = data.paymentCode
    ? `Payment: ${paymentLabel} (Code: ${data.paymentCode})`
    : `Payment: ${paymentLabel}`;
  const lines = [
    businessName,
    data.address ?? '',
    `Date: ${date} ${time}`,
    `Receipt #: ${receiptNumber}`,
    paymentLine,
    '',
    ...data.items.map(
      (i) =>
        `${i.name} x${i.qty} @ ${formatUGX(i.unitPrice)} = ${formatUGX(i.lineTotal)}`
    ),
    '',
    `Total: ${formatUGX(data.total)}`,
    'Thank you for your purchase',
  ].filter(Boolean);

  const receiptText = lines.join('\n');
  
  const copyReceipt = () => {
    navigator.clipboard.writeText(receiptText).then(() => {
      alert('Receipt copied to clipboard!');
    });
  };
  
  const shareToWhatsApp = () => {
    const text = encodeURIComponent(receiptText);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };
  
  const saveToDevice = () => {
    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${data.orderId}-${format(new Date(data.createdAt), 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="receipt-container">
      {/* Action Buttons */}
      <div className="receipt-actions no-print flex-wrap gap-2 mb-4">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 touch-target sm:px-4 transition"
          >
            Close
          </button>
        )}
        <button
          type="button"
          onClick={printReceipt}
          className="rounded-lg bg-tufts-blue px-3 py-2 text-sm font-medium text-white hover:opacity-90 touch-target sm:px-4 transition"
        >
          🖨️ Print
        </button>
        <button 
          type="button" 
          onClick={shareToWhatsApp} 
          className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 touch-target sm:px-4 transition"
        >
          💬 WhatsApp
        </button>
        <button 
          type="button" 
          onClick={copyReceipt} 
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 touch-target sm:px-4 transition"
        >
          📋 Copy
        </button>
        <button 
          type="button" 
          onClick={saveToDevice} 
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 touch-target sm:px-4 transition"
        >
          💾 Save
        </button>
      </div>

      {/* Receipt Paper */}
      <div className="receipt-paper">
        {/* Header */}
        <header className="receipt-header">
          <div className="receipt-logo-wrapper">
            <img src="/logo.png" alt="Logo" className="receipt-logo" />
          </div>
          <h1 className="receipt-business">{businessName}</h1>
          {data.address && (
            <div className="receipt-business-address">
              <MapPin className="receipt-icon-small" />
              <span>{data.address}</span>
            </div>
          )}
          {(data.businessPhone || data.businessEmail) && (
            <div className="receipt-business-contact">
              {data.businessPhone && (
                <div className="receipt-contact-line">
                  <Phone className="receipt-icon-small" />
                  <span>Call / WhatsApp: {data.businessPhone}</span>
                </div>
              )}
              {data.businessEmail && (
                <div className="receipt-contact-line">
                  <span className="receipt-contact-email">{data.businessEmail}</span>
                </div>
              )}
            </div>
          )}
        </header>

        {/* Receipt Info Section */}
        <div className="receipt-info-section">
          <div className="receipt-info-row">
            <div className="receipt-info-item">
              <ReceiptIcon className="receipt-icon" />
              <div>
                <span className="receipt-info-label">Receipt #</span>
                <span className="receipt-info-value">{receiptNumber}</span>
              </div>
            </div>
            <div className="receipt-info-item">
              <Calendar className="receipt-icon" />
              <div>
                <span className="receipt-info-label">Date</span>
                <span className="receipt-info-value">{date}</span>
              </div>
            </div>
          </div>
          <div className="receipt-info-row">
            <div className="receipt-info-item">
              <div className="receipt-time">{time}</div>
            </div>
            <div className="receipt-info-item">
              <CreditCard className="receipt-icon" />
              <div>
                <span className="receipt-info-label">Payment</span>
                <span className="receipt-info-value">{paymentLabel}</span>
                {data.paymentCode && (
                  <span className="receipt-payment-code">Code: {data.paymentCode}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Details */}
        {(data.customerName || data.customerPhone) && (
          <div className="receipt-customer-section">
            <div className="receipt-section-title">
              <User className="receipt-icon" />
              <span>Customer Details</span>
            </div>
            <div className="receipt-customer-details">
              {data.customerName && (
                <div className="receipt-customer-item">
                  <User className="receipt-icon-small" />
                  <span>{data.customerName}</span>
                </div>
              )}
              {data.customerPhone && (
                <div className="receipt-customer-item">
                  <Phone className="receipt-icon-small" />
                  <span>{data.customerPhone}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items Section */}
        <div className="receipt-items-section">
          <div className="receipt-section-title">
            <span>Items</span>
          </div>
          <div className="receipt-items-list">
            {data.items.map((item, i) => (
              <div key={i} className="receipt-item-row">
                <div className="receipt-item-main">
                  <span className="receipt-item-name">{item.name}</span>
                  {item.originalPrice != null && item.originalPrice > item.unitPrice && (
                    <div className="receipt-item-discount">
                      <span className="receipt-item-original">
                        {formatUGX(item.originalPrice)} × {item.qty}
                      </span>
                      <span className="receipt-discount-badge">Discount applied</span>
                    </div>
                  )}
                </div>
                <div className="receipt-item-details">
                  <div className="receipt-item-qty">{item.qty} ×</div>
                  <div className="receipt-item-price">
                    {item.originalPrice != null && item.originalPrice > item.unitPrice ? (
                      <div>
                        <span className="receipt-price-original">{formatUGX(item.originalPrice)}</span>
                        <span className="receipt-price-current">{formatUGX(item.unitPrice)}</span>
                      </div>
                    ) : (
                      formatUGX(item.unitPrice)
                    )}
                  </div>
                  <div className="receipt-item-total">{formatUGX(item.lineTotal)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Section */}
        <div className="receipt-total-section">
          <div className="receipt-total-row">
            <span className="receipt-total-label">Total</span>
            <span className="receipt-total-amount">{formatUGX(data.total)}</span>
          </div>
        </div>

        {/* Footer */}
        <footer className="receipt-footer">
          <p className="receipt-footer-text">Thank you for shopping with us!</p>
          <p className="receipt-footer-subtext">We appreciate your business</p>
        </footer>
      </div>

      <style>{`
        /* Print: optimized for 80mm thermal (e.g. Star Micronics TSP143III). Select this printer in the browser print dialog. */
        @media print {
          body * { visibility: hidden; }
          .receipt-container, .receipt-container * { visibility: visible; }
          .receipt-container { position: absolute; left: 0; top: 0; width: 80mm; max-width: 80mm; background: white; padding: 0; }
          .no-print { display: none !important; }
          .receipt-paper { box-shadow: none; border: none; width: 80mm; max-width: 80mm; padding: 4mm 3mm; }
          @page { size: 80mm auto; margin: 0; }
        }
        
        .receipt-container {
          width: 100%;
          max-width: 100%;
        }
        
        .receipt-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .receipt-paper {
          max-width: 100%;
          width: 100%;
          margin: 0 auto;
          padding: 20px 16px;
          background: linear-gradient(to bottom, #ffffff 0%, #fafafa 100%);
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }
        
        @media (min-width: 640px) {
          .receipt-paper {
            max-width: 400px;
            padding: 32px 24px;
          }
        }
        
        /* Header */
        .receipt-header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 2px solid #e2e8f0;
          margin-bottom: 20px;
        }
        
        .receipt-logo-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }
        
        .receipt-logo {
          height: 64px;
          width: 64px;
          object-fit: contain;
        }
        
        .receipt-business {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 8px 0;
          color: #0f172a;
          letter-spacing: -0.02em;
        }
        
        .receipt-business-address {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.8125rem;
          color: #64748b;
          margin-top: 8px;
          line-height: 1.4;
        }
        
        .receipt-business-contact {
          margin-top: 10px;
          font-size: 0.8125rem;
          color: #475569;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        
        .receipt-contact-line {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .receipt-contact-email {
          word-break: break-all;
        }
        
        /* Info Section */
        .receipt-info-section {
          background: #f8fafc;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }
        
        .receipt-info-row {
          display: flex;
          gap: 12px;
          margin-bottom: 8px;
        }
        
        .receipt-info-row:last-child {
          margin-bottom: 0;
        }
        
        .receipt-info-item {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .receipt-info-item > div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .receipt-icon {
          width: 16px;
          height: 16px;
          color: #64748b;
          flex-shrink: 0;
        }
        
        .receipt-icon-small {
          width: 14px;
          height: 14px;
          color: #64748b;
          flex-shrink: 0;
        }
        
        .receipt-info-label {
          font-size: 0.6875rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        
        .receipt-info-value {
          font-size: 0.875rem;
          color: #0f172a;
          font-weight: 600;
        }
        
        .receipt-time {
          font-size: 0.875rem;
          color: #64748b;
          font-weight: 500;
        }
        
        .receipt-payment-code {
          display: block;
          font-size: 0.75rem;
          color: #059669;
          font-weight: 600;
          margin-top: 2px;
        }
        
        /* Customer Section */
        .receipt-customer-section {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }
        
        .receipt-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #166534;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .receipt-customer-details {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .receipt-customer-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.875rem;
          color: #0f172a;
        }
        
        /* Items Section */
        .receipt-items-section {
          margin-bottom: 20px;
        }
        
        .receipt-items-section .receipt-section-title {
          color: #0f172a;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .receipt-items-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .receipt-item-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        
        .receipt-item-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        
        .receipt-item-main {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .receipt-item-name {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #0f172a;
        }
        
        .receipt-item-discount {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
        }
        
        .receipt-item-original {
          text-decoration: line-through;
          color: #94a3b8;
        }
        
        .receipt-discount-badge {
          background: #dcfce7;
          color: #166534;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.6875rem;
        }
        
        .receipt-item-details {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        
        .receipt-item-qty {
          font-size: 0.8125rem;
          color: #64748b;
          font-weight: 500;
        }
        
        .receipt-item-price {
          font-size: 0.8125rem;
          color: #64748b;
          flex: 1;
          text-align: center;
        }
        
        .receipt-price-original {
          text-decoration: line-through;
          color: #94a3b8;
          margin-right: 4px;
        }
        
        .receipt-price-current {
          color: #059669;
          font-weight: 600;
        }
        
        .receipt-item-total {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #0f172a;
          min-width: 80px;
          text-align: right;
        }
        
        /* Total Section */
        .receipt-total-section {
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        
        .receipt-total-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .receipt-total-label {
          font-size: 1.125rem;
          font-weight: 600;
          color: #ffffff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        
        .receipt-total-amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
        }
        
        /* Footer */
        .receipt-footer {
          text-align: center;
          padding-top: 16px;
          border-top: 1px dashed #cbd5e1;
        }
        
        .receipt-footer-text {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        
        .receipt-footer-subtext {
          font-size: 0.75rem;
          color: #94a3b8;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
