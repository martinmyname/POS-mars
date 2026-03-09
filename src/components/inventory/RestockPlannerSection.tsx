import { useState, useMemo, useEffect, useRef } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Money } from '@/components/Money';
import { exportToCSV } from '@/utils/exportUtils';
import {
  AlertTriangle,
  Download,
  Printer,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Building2,
  Flame,
  Box,
  Wind,
  Moon,
  X,
} from 'lucide-react';
import type { RestockItem } from '@/hooks/inventory/useRestockData';

type StatusFilter = 'all' | 'out' | 'critical' | 'low' | 'ok';
type VelocityFilter = 'all' | 'fast' | 'moderate' | 'slow' | 'none';

interface RestockPlannerSectionProps {
  items: RestockItem[];
  summaryStats: {
    outCount: number;
    criticalCount: number;
    lowCount: number;
    deadCount: number;
    totalRevenueAtRisk: number;
    needsRestockCount: number;
  };
  isLoading: boolean;
  onMarkAsReceived?: (selected: Array<{ item: RestockItem; qty: number }>) => Promise<void>;
}

export function RestockPlannerSection({
  items,
  summaryStats,
  isLoading,
  onMarkAsReceived,
}: RestockPlannerSectionProps) {
  useTheme();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [velocityFilter, setVelocityFilter] = useState<VelocityFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [showDeadStock, setShowDeadStock] = useState(false);
  const [groupBySupplier, setGroupBySupplier] = useState(false);
  const [revenueBannerDismissed, setRevenueBannerDismissed] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [customQtys, setCustomQtys] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => i.supplierName && i.supplierName !== '—' && set.add(i.supplierName));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (!showDeadStock) list = list.filter((i) => !i.isDead);
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku ?? '').toLowerCase().includes(q) ||
          (i.category ?? '').toLowerCase().includes(q)
      );
    if (statusFilter !== 'all')
      list = list.filter((i) => i.status === statusFilter);
    if (velocityFilter !== 'all')
      list = list.filter((i) => i.velocity === velocityFilter);
    if (supplierFilter !== 'all')
      list = list.filter((i) => i.supplierName === supplierFilter);
    return list;
  }, [items, search, statusFilter, velocityFilter, supplierFilter, showDeadStock]);

  const selectAllNeeded = () => {
    const next = new Set(selectedIds);
    filteredItems
      .filter((i) => i.needsRestock && !i.isDead)
      .forEach((i) => next.add(i.id));
    setSelectedIds(next);
  };
  const clearSelection = () => setSelectedIds(new Set());

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  );
  const orderQty = (item: RestockItem) =>
    customQtys[item.id] ?? item.suggestedQty;
  const orderTotalCost = useMemo(() => {
    const total = selectedItems.reduce(
      (s, i) => s + (Number(orderQty(i)) || 0) * (Number(i.costPrice) || 0),
      0
    );
    return Number.isFinite(total) ? total : 0;
  }, [selectedItems, customQtys]);

  const healthScore = useMemo(() => {
    if (items.length === 0) return { score: 100, label: 'Healthy', color: 'emerald' };
    const stockCoverage = items.filter((i) => i.stock > i.minStockLevel).length / items.length;
    const noDead = 1 - summaryStats.deadCount / items.length;
    const activeSelling = items.filter((i) => i.avgDailySales > 0).length / items.length;
    const score = Math.round(
      stockCoverage * 50 + noDead * 30 + activeSelling * 20
    );
    const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Needs attention' : 'Critical';
    const color = score >= 80 ? 'emerald' : score >= 60 ? 'amber' : 'red';
    return { score: Math.min(100, Math.max(0, score)), label, color };
  }, [items, summaryStats.deadCount]);

  const initialSelectDone = useRef(false);
  useEffect(() => {
    if (initialSelectDone.current || items.length === 0) return;
    const needed = items.filter((i) => i.needsRestock && !i.isDead).map((i) => i.id);
    if (needed.length > 0) {
      setSelectedIds(new Set(needed));
      initialSelectDone.current = true;
    }
  }, [items]);

  if (isLoading)
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading restock data…
      </div>
    );

  return (
    <div className="restock-planner-print-container space-y-4">
      {/* Step 14 — Inventory Health Score + Step 3 — Summary cards */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className={`card flex flex-col items-center justify-center border-2 p-4 ${
          healthScore.color === 'emerald' ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30' :
          healthScore.color === 'amber' ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30' :
          'border-red-300 bg-red-50/50 dark:border-red-700 dark:bg-red-950/30'
        }`}>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Inventory Health</p>
          <p className={`text-3xl font-bold ${
            healthScore.color === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' :
            healthScore.color === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
          }`}>{healthScore.score}</p>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{healthScore.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 flex-1">
        <div className="card border-red-200 bg-red-50/50 p-3 dark:border-red-800 dark:bg-red-950/30">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Out of Stock</p>
          <p className="text-xl font-bold text-red-800 dark:text-red-200">{summaryStats.outCount}</p>
        </div>
        <div className="card border-orange-200 bg-orange-50/50 p-3 dark:border-orange-800 dark:bg-orange-950/30">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Critical</p>
          <p className="text-xl font-bold text-orange-800 dark:text-orange-200">{summaryStats.criticalCount}</p>
        </div>
        <div className="card border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Low Stock</p>
          <p className="text-xl font-bold text-amber-800 dark:text-amber-200">{summaryStats.lowCount}</p>
        </div>
        <div className="card border-teal-200 bg-teal-50/50 p-3 dark:border-teal-800 dark:bg-teal-950/30">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Selected to Order</p>
          <p className="text-xl font-bold text-teal-800 dark:text-teal-200">{selectedIds.size}</p>
        </div>
        <div className="card border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Order Total Cost</p>
          <p className="text-xl font-bold text-amber-800 dark:text-amber-200"><Money value={Number.isFinite(orderTotalCost) ? orderTotalCost : 0} className="text-xl font-bold text-amber-800 dark:text-amber-200" /></p>
        </div>
        </div>
      </div>

      {/* Step 4 — Revenue at risk banner */}
      {summaryStats.totalRevenueAtRisk > 0 && !revenueBannerDismissed && (
        <div className="card flex items-center justify-between gap-3 border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/40">
          <p className="flex items-center gap-2 text-sm font-medium text-red-800 dark:text-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Revenue at risk from low/out-of-stock items this restock cycle: <Money value={summaryStats.totalRevenueAtRisk} className="text-red-800 dark:text-red-200" />
          </p>
          <button
            type="button"
            onClick={() => setRevenueBannerDismissed(true)}
            className="shrink-0 rounded p-1 text-red-600 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 5 — Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          placeholder="Search by name, SKU, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base max-w-[200px] py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="input-base w-auto py-2 text-sm"
        >
          <option value="all">All Status</option>
          <option value="out">Out</option>
          <option value="critical">Critical</option>
          <option value="low">Low</option>
          <option value="ok">OK</option>
        </select>
        <select
          value={velocityFilter}
          onChange={(e) => setVelocityFilter(e.target.value as VelocityFilter)}
          className="input-base w-auto py-2 text-sm"
        >
          <option value="all">All Velocity</option>
          <option value="fast">Fast (≥3/day)</option>
          <option value="moderate">Moderate</option>
          <option value="slow">Slow</option>
          <option value="none">No sales</option>
        </select>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="input-base w-auto py-2 text-sm"
        >
          <option value="all">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDeadStock}
            onChange={(e) => setShowDeadStock(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show dead stock
        </label>
        <button
          type="button"
          onClick={() => setGroupBySupplier((b) => !b)}
          className={`btn-secondary py-2 text-sm ${groupBySupplier ? 'ring-2 ring-tufts-blue' : ''}`}
        >
          Group by Supplier
        </button>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={selectAllNeeded} className="btn-secondary py-2 text-sm">
            Select All
          </button>
          <button type="button" onClick={clearSelection} className="btn-secondary py-2 text-sm">
            Clear
          </button>
        </div>
      </div>

      {/* Step 6–8 — Table or grouped view */}
      {groupBySupplier ? (
        <GroupBySupplierView
          items={filteredItems}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          customQtys={customQtys}
          setCustomQtys={setCustomQtys}
          orderQty={orderQty}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      ) : (
        <RestockTable
          items={filteredItems}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          customQtys={customQtys}
          setCustomQtys={setCustomQtys}
          orderQty={orderQty}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
        />
      )}

      {/* Step 9 — Order summary footer */}
      {selectedIds.size > 0 && (
        <OrderSummaryFooter
          selectedItems={selectedItems}
          orderQty={orderQty}
          orderTotalCost={orderTotalCost}
          onExport={() => {
            const rows = selectedItems
              .sort((a, b) => b.priority - a.priority)
              .map((i) => [
                i.priority,
                i.name,
                i.sku,
                i.category,
                i.supplierName,
                i.status,
                i.stock,
                i.minStockLevel,
                orderQty(i),
                i.costPrice,
                orderQty(i) * i.costPrice,
                i.avgDailySales,
                i.daysUntilStockout === 999 ? '' : i.daysUntilStockout,
                i.coverageAfterRestock === 999 ? '' : i.coverageAfterRestock,
                i.velocity,
              ]);
            exportToCSV(
              'restock_order',
              [
                'Priority',
                'Product',
                'SKU',
                'Category',
                'Supplier',
                'Status',
                'Current Stock',
                'Min Level',
                'Order Qty',
                'Cost/Unit (UGX)',
                'Total Cost (UGX)',
                'Avg Daily Sales',
                'Days Until Stockout',
                'Days Cover After Restock',
                'Velocity',
              ],
              rows
            );
          }}
          onPrint={() => window.print()}
          onMarkAsReceived={
            onMarkAsReceived
              ? async () => {
                  setReceiving(true);
                  try {
                    await onMarkAsReceived(
                      selectedItems.map((item) => ({ item, qty: orderQty(item) }))
                    );
                    setSelectedIds(new Set());
                    setCustomQtys({});
                  } finally {
                    setReceiving(false);
                  }
                }
              : undefined
          }
          receiving={receiving}
        />
      )}
    </div>
  );
}

function RestockTable({
  items,
  selectedIds,
  setSelectedIds,
  setCustomQtys,
  orderQty,
  expandedId,
  setExpandedId,
}: {
  items: RestockItem[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  customQtys: Record<string, number>;
  setCustomQtys: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  orderQty: (i: RestockItem) => number;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
}) {
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
      <table className="w-full text-sm print:text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50">
            <th className="w-10 px-2 py-2 text-left no-print" />
            <th className="px-3 py-2 text-left font-medium">Product</th>
            <th className="px-2 py-2 text-left font-medium">Status</th>
            <th className="px-2 py-2 text-left font-medium">Days Left</th>
            <th className="px-2 py-2 text-left font-medium">Velocity</th>
            <th className="px-2 py-2 text-left font-medium">Order Qty</th>
            <th className="px-2 py-2 text-right font-medium">Est. Cost</th>
            <th className="w-12 px-2 py-2 no-print" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <RestockRow
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              orderQty={orderQty(item)}
              onQtyChange={(q) =>
                setCustomQtys((prev) => ({ ...prev, [item.id]: q }))
              }
              onResetQty={() => {
                setCustomQtys((prev => {
                  const next = { ...prev };
                  delete next[item.id];
                  return next;
                }));
              }}
              isExpanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RestockRow({
  item,
  isSelected,
  onToggleSelect,
  orderQty,
  onQtyChange,
  onResetQty,
  isExpanded,
  onToggleExpand,
}: {
  item: RestockItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  orderQty: number;
  onQtyChange: (q: number) => void;
  onResetQty: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const daysLeft =
    item.stock === 0 || item.daysUntilStockout === 0
      ? 'Out'
      : item.daysUntilStockout <= 1
        ? '<1d'
        : item.daysUntilStockout <= 3
          ? `${Math.round(item.daysUntilStockout)}d`
          : item.daysUntilStockout < 999
            ? `${Math.round(item.daysUntilStockout)}d`
            : '—';
  const velocityLabel =
    item.velocity === 'fast'
      ? `${item.avgDailySales}/day`
      : item.velocity === 'moderate' || item.velocity === 'slow'
        ? `${item.avgDailySales}/day`
        : '0/day';
  const totalCost = orderQty * item.costPrice;
  const suggestedDiff = orderQty !== item.suggestedQty;

  return (
    <>
      <tr
        className={`border-b border-slate-100 dark:border-slate-700 ${
          item.status === 'out' ? 'bg-red-50/50 dark:bg-red-950/20' : ''
        } ${item.isDead ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}
        style={{ borderLeft: `4px solid ${item.priority >= 70 ? '#b91c1c' : item.priority >= 40 ? '#ea580c' : item.priority >= 20 ? '#d97706' : '#15803d'}` }}
      >
        <td className="px-2 py-2 no-print">
          {!item.isDead && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
              className="p-1"
            >
              {isSelected ? <CheckSquare className="h-4 w-4 text-tufts-blue" /> : <Square className="h-4 w-4 text-slate-400" />}
            </button>
          )}
        </td>
        <td
          className="cursor-pointer px-3 py-2"
          onClick={onToggleExpand}
        >
          <div>
            <p className="font-medium text-smoky-black dark:text-white">
              {item.name}
              {item.isDead && (
                <span className="ml-2 inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                  <Moon className="h-3 w-3" /> DEAD STOCK
                </span>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {item.sku && <span className="font-medium text-slate-600 dark:text-slate-300">SKU: {item.sku}</span>}
              {item.sku && (item.category || item.supplierName !== '—') && ' · '}
              {[item.category, item.supplierName !== '—' ? item.supplierName : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </td>
        <td className="px-2 py-2">
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
              item.status === 'out'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                : item.status === 'critical'
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200'
                  : item.status === 'low'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
            }`}
          >
            {item.status === 'out'
              ? 'Out of Stock'
              : item.status === 'critical'
                ? 'Critical'
                : item.status === 'low'
                  ? 'Low'
                  : 'OK'}
          </span>
        </td>
        <td className={`px-2 py-2 text-xs font-medium ${
          item.stock === 0 ? 'text-red-700 dark:text-red-300' : item.daysUntilStockout <= 1 ? 'text-orange-700' : item.daysUntilStockout <= 3 ? 'text-amber-700' : 'text-slate-500'
        }`}>
          {daysLeft}
        </td>
        <td className="px-2 py-2">
          <span className={`flex items-center gap-1 text-xs ${
            item.velocity === 'fast' ? 'text-emerald-600' : item.velocity === 'moderate' ? 'text-blue-600' : 'text-slate-500'
          }`}>
            {item.velocity === 'fast' && <Flame className="h-3.5 w-3.5" />}
            {item.velocity === 'moderate' && <Box className="h-3.5 w-3.5" />}
            {item.velocity === 'slow' && <Wind className="h-3.5 w-3.5" />}
            {item.velocity === 'none' && <Moon className="h-3.5 w-3.5" />}
            {velocityLabel}
          </span>
        </td>
        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
          <div>
            <input
              type="number"
              min={1}
              value={orderQty}
              onChange={(e) => onQtyChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="input-base w-20 py-1 text-center text-sm"
            />
            <p className="text-xs text-slate-500">→ {item.coverageAfterRestock < 999 ? `${item.coverageAfterRestock}d` : '—'} cover</p>
            {suggestedDiff && (
              <button type="button" onClick={onResetQty} className="text-xs text-tufts-blue hover:underline">
                suggested: {item.suggestedQty}
              </button>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-right">
          <p className="font-semibold"><Money value={totalCost} className="font-semibold" /></p>
          <p className="text-xs text-slate-500"><Money value={item.costPrice} className="text-slate-500" />/unit</p>
        </td>
        <td className="px-2 py-2 no-print">
          <button type="button" onClick={onToggleExpand} className="p-1">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-slate-200 bg-slate-50/50 dark:bg-slate-800/30">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
              <p><span className="text-slate-500">Current Stock</span> {item.stock}</p>
              <p><span className="text-slate-500">Min Level</span> {item.minStockLevel}</p>
              <p><span className="text-slate-500">Restock Cycle</span> {item.restockCycleDays}d</p>
              <p><span className="text-slate-500">Revenue at Risk</span> <Money value={item.revenueAtRisk} className="text-sm" /></p>
              <p><span className="text-slate-500">Avg Daily Sales</span> {item.avgDailySales}</p>
              <p><span className="text-slate-500">Last Sold</span> {item.lastSoldDaysAgo < 999 ? `${item.lastSoldDaysAgo}d ago` : 'Never'}</p>
              <p><span className="text-slate-500">Sell Price</span> <Money value={item.retailPrice} className="text-sm" /></p>
              <p><span className="text-slate-500">Gross Margin %</span> {item.retailPrice > 0 ? Math.round(((item.retailPrice - item.costPrice) / item.retailPrice) * 100) : 0}%</p>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <strong>Why {item.suggestedQty} units?</strong> {item.whyText}
            </p>
            {item.isDead && (
              <p className="mt-2 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                This item has not sold in 30+ days. Consider a promotion, price reduction, or removing it from your menu before restocking.
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function GroupBySupplierView(
  props: {
    items: RestockItem[];
    selectedIds: Set<string>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    customQtys: Record<string, number>;
    setCustomQtys: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    orderQty: (i: RestockItem) => number;
    expandedId: string | null;
    setExpandedId: (id: string | null) => void;
  }
) {
  const { items, ...rest } = props;
  const bySupplier = useMemo(() => {
    const map: Record<string, RestockItem[]> = {};
    items.forEach((i) => {
      const key = i.supplierName || '—';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [items]);

  return (
    <div className="space-y-6">
      {Object.entries(bySupplier).map(([supplierName, list]) => {
        const subtotal = list
          .filter((i) => rest.selectedIds.has(i.id))
          .reduce((s, i) => s + rest.orderQty(i) * i.costPrice, 0);
        return (
          <div key={supplierName} className="card overflow-hidden p-0">
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/50">
              <Building2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              <span className="font-semibold">{supplierName}</span>
              <span className="text-sm text-slate-500">
                ({list.length} items · <Money value={subtotal} className="text-slate-500" />)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {list.map((item) => (
                    <RestockRow
                      key={item.id}
                      item={item}
                      isSelected={rest.selectedIds.has(item.id)}
                      onToggleSelect={() => {
                        rest.setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                      orderQty={rest.orderQty(item)}
                      onQtyChange={(q) => rest.setCustomQtys((p) => ({ ...p, [item.id]: q }))}
                      onResetQty={() => rest.setCustomQtys((p) => { const n = { ...p }; delete n[item.id]; return n; })}
                      isExpanded={rest.expandedId === item.id}
                      onToggleExpand={() => rest.setExpandedId(rest.expandedId === item.id ? null : item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderSummaryFooter({
  selectedItems,
  orderQty,
  orderTotalCost,
  onExport,
  onPrint,
  onMarkAsReceived,
  receiving,
}: {
  selectedItems: RestockItem[];
  orderQty: (i: RestockItem) => number;
  orderTotalCost: number;
  onExport: () => void;
  onPrint: () => void;
  onMarkAsReceived?: () => Promise<void>;
  receiving: boolean;
}) {
  const bySupplier = useMemo(() => {
    const map: Record<string, RestockItem[]> = {};
    selectedItems.forEach((i) => {
      const key = i.supplierName || '—';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return map;
  }, [selectedItems]);

  const sortedForPrint = useMemo(
    () => [...selectedItems].sort((a, b) => b.priority - a.priority),
    [selectedItems]
  );

  return (
    <>
      <div className="card border-t-2 border-teal-200 bg-teal-50/30 p-4 dark:border-teal-800 dark:bg-teal-950/30 no-print">
        <h3 className="mb-3 font-sans text-lg font-semibold">Order Summary — {selectedItems.length} products selected</h3>
        <div className="space-y-2">
          {Object.entries(bySupplier).map(([name, list]) => (
            <div key={name}>
              <p className="font-medium text-slate-800 dark:text-slate-200">{name}</p>
              <ul className="list-inside list-disc text-sm text-slate-600 dark:text-slate-400">
                {list.map((i) => (
                  <li key={i.id}>{i.name}{i.sku ? ` (${i.sku})` : ''} ×{orderQty(i)}</li>
                ))}
              </ul>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Subtotal: <Money value={list.reduce((s, i) => s + orderQty(i) * i.costPrice, 0)} className="text-slate-700 dark:text-slate-300" />
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 border-t border-slate-200 pt-3 text-lg font-bold dark:border-slate-600">
          Total restock investment: <Money value={orderTotalCost} className="text-lg font-bold" />
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={onExport} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Download className="h-4 w-4" /> Export Order CSV
          </button>
          <button type="button" onClick={onPrint} className="btn-secondary inline-flex items-center gap-2 text-sm">
            <Printer className="h-4 w-4" /> Print Shopping List
          </button>
          {onMarkAsReceived && (
            <button
              type="button"
              onClick={onMarkAsReceived}
              disabled={receiving}
              className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {receiving ? 'Updating…' : 'Mark as Received'}
            </button>
          )}
        </div>
      </div>
      {/* Print-only shopping list */}
      <div className="hidden print:block print:break-before-auto" style={{ fontSize: '12px', color: '#000', background: '#fff' }}>
        <h2 className="text-lg font-bold mb-2">RESTOCK ORDER — Mars Kitchen Essentials</h2>
        <p className="mb-3 text-sm">
          Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} | Total: <Money value={orderTotalCost} />
        </p>
        <table className="w-full border-collapse text-sm" style={{ fontSize: '12px' }}>
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1 pr-2">#</th>
              <th className="text-left py-1 pr-2">Product</th>
              <th className="text-left py-1 pr-2">Supplier</th>
              <th className="text-right py-1 pr-2">Qty</th>
              <th className="text-right py-1 pr-2">Unit Cost</th>
              <th className="text-right py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedForPrint.map((i, idx) => (
              <tr key={i.id} className="border-b border-gray-300">
                <td className="py-1 pr-2">{idx + 1}</td>
                <td className="py-1 pr-2">{i.name}{i.sku ? ` (${i.sku})` : ''}</td>
                <td className="py-1 pr-2">{i.supplierName}</td>
                <td className="text-right py-1 pr-2">{orderQty(i)}</td>
                <td className="text-right py-1 pr-2"><Money value={i.costPrice} /></td>
                <td className="text-right py-1"><Money value={orderQty(i) * i.costPrice} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 font-bold text-right">TOTAL: <Money value={orderTotalCost} className="font-bold" /></p>
        <p className="mt-2 text-xs text-gray-600">Grouped by supplier — place separate orders with each supplier.</p>
      </div>
    </>
  );
}
