import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cashSessionsApi, generateId } from '@/hooks/useData';
import { formatUGX } from '@/lib/formatUGX';
import { getTodayInAppTz } from '@/lib/appTimezone';
import { Banknote, X } from 'lucide-react';

interface CashOpenPromptModalProps {
  /** Last closed session's closing amount, for placeholder/suggestion */
  lastClosedAmount?: number | null;
  /** Called after session is successfully opened */
  onOpen: () => void;
  /** Called when user chooses to open manually later (dismiss) */
  onDismiss: () => void;
}

/**
 * Modal shown when user tries to place the first order of the day without an open cash session.
 * Blocks order placement until they enter opening cash and confirm, or dismiss to open manually.
 */
export function CashOpenPromptModal({ lastClosedAmount, onOpen, onDismiss }: CashOpenPromptModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleOpen = async () => {
    setError(null);
    const amt = amount.trim() ? parseFloat(amount.replace(/,/g, '')) : lastClosedAmount;
    if (amt == null || Number.isNaN(amt) || amt < 0) {
      setError(lastClosedAmount != null ? 'Enter a valid amount or leave blank to use last closed' : 'Enter a valid opening amount');
      return;
    }
    setSubmitting(true);
    try {
      const todayStr = getTodayInAppTz();
      const existing = await cashSessionsApi.getByDate(todayStr);
      if (existing) {
        setError('A session for today already exists.');
        setSubmitting(false);
        return;
      }
      await cashSessionsApi.insert({
        id: `cash_${generateId()}`,
        date: todayStr,
        openingAmount: amt,
        openedAt: new Date().toISOString(),
        openedBy: user?.email || 'Staff',
      });
      onOpen();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open cash drawer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-6 w-6 text-tufts-blue" />
            <h2 className="font-sans text-xl font-semibold text-smoky-black">Open cash drawer</h2>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-slate-600">
          No cash session for today. Enter the opening amount to continue placing your order.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="cash-open-amount" className="mb-1 block text-sm font-medium text-slate-700">
              Opening amount (UGX) *
            </label>
            <input
              id="cash-open-amount"
              type="text"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/,/g, ''));
                setError(null);
              }}
              placeholder={
                lastClosedAmount != null
                  ? `Leave blank to use last closed (${formatUGX(lastClosedAmount)})`
                  : 'Enter opening cash amount'
              }
              className={`input-base w-full ${error ? 'border-red-300' : ''}`}
              autoFocus
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse sm:gap-2">
          <button
            type="button"
            onClick={handleOpen}
            disabled={submitting}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {submitting ? 'Opening…' : 'Open and continue'}
          </button>
          <button
            type="button"
            onClick={() => {
              onDismiss();
              navigate('/cash');
            }}
            className="btn-secondary flex-1"
          >
            Open manually later
          </button>
        </div>
      </div>
    </div>
  );
}
