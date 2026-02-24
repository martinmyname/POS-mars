import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { getTodayInAppTz } from '@/lib/appTimezone';
import { triggerImmediateSync } from '@/lib/rxdb';
import { AlertTriangle, Package, Pencil, Search, X } from 'lucide-react';

interface ProductDoc {
  id: string;
  sku: string;
  name: string;
  category: string;
  barcode?: string;
  retailPrice: number;
  wholesalePrice: number;
  costPrice: number;
  stock: number;
  minStockLevel: number;
  supplierId?: string;
}

interface SupplierDoc {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const db = useRxDB();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDoc[]>([]);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [retailPrice, setRetailPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('0');
  const [supplierId, setSupplierId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [addStockFor, setAddStockFor] = useState<string | null>(null);
  const [addStockQty, setAddStockQty] = useState('');
  const [addStockPayment, setAddStockPayment] = useState<'cash' | 'credit'>('cash');
  const [addStockSupplierId, setAddStockSupplierId] = useState('');
  const [skuError, setSkuError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editRetailPrice, setEditRetailPrice] = useState('');
  const [editWholesalePrice, setEditWholesalePrice] = useState('');
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editMinStockLevel, setEditMinStockLevel] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editSkuError, setEditSkuError] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  
  // Validation errors for immediate feedback
  const [retailPriceError, setRetailPriceError] = useState<string | null>(null);
  const [costPriceError, setCostPriceError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [minStockLevelError, setMinStockLevelError] = useState<string | null>(null);
  const [addStockQtyError, setAddStockQtyError] = useState<string | null>(null);
  const [editRetailPriceError, setEditRetailPriceError] = useState<string | null>(null);
  const [editCostPriceError, setEditCostPriceError] = useState<string | null>(null);
  const [editStockError, setEditStockError] = useState<string | null>(null);
  const [editMinStockLevelError, setEditMinStockLevelError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const sub = db.products.find().$.subscribe((docs) => {
      setProducts(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .map((d) => ({
            id: d.id,
            sku: d.sku,
            name: d.name,
            category: d.category,
            barcode: (d as { barcode?: string }).barcode,
            retailPrice: d.retailPrice,
            wholesalePrice: d.wholesalePrice,
            costPrice: d.costPrice,
            stock: d.stock,
            minStockLevel: d.minStockLevel,
            supplierId: (d as { supplierId?: string }).supplierId,
          }))
      );
    });
    return () => sub.unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const sub = db.suppliers.find().$.subscribe((docs) => {
      setSuppliers(
        docs
          .filter((d) => !(d as { _deleted?: boolean })._deleted)
          .map((d) => ({ id: d.id, name: d.name }))
      );
    });
    return () => sub.unsubscribe();
  }, [db]);

  // When Inventory page is open, periodically pull latest products so stock stays in sync across users.
  useEffect(() => {
    if (!db) return;
    const interval = setInterval(() => {
      triggerImmediateSync('products');
    }, 15_000);
    return () => clearInterval(interval);
  }, [db]);

  const valuationCost = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const valuationRetail = products.reduce((s, p) => s + p.stock * p.retailPrice, 0);

  const productsWithRetailAtOrBelowCost = useMemo(
    () => products.filter((p) => p.retailPrice <= p.costPrice),
    [products]
  );
  const showRetailBelowCostWarning = valuationRetail < valuationCost && products.length > 0;

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.trim().toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  // Real-time SKU validation
  useEffect(() => {
    if (!db || !sku.trim()) {
      setSkuError(null);
      return;
    }
    const checkSku = async () => {
      try {
        const existing = await db.products.findOne({ selector: { sku: sku.trim() } }).exec();
        if (existing && !(existing as { _deleted?: boolean })._deleted) {
          setSkuError(`SKU "${sku.trim()}" already exists`);
        } else {
          setSkuError(null);
        }
      } catch (_) {
        setSkuError(null);
      }
    };
    const timeoutId = setTimeout(checkSku, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [sku, db, products]);

  // Edit SKU validation (duplicate only if another product has this SKU)
  useEffect(() => {
    if (!db || !editingProductId || !editSku.trim()) {
      setEditSkuError(null);
      return;
    }
    const check = async () => {
      const existing = await db.products.findOne({ selector: { sku: editSku.trim() } }).exec();
      if (existing && existing.id !== editingProductId && !(existing as { _deleted?: boolean })._deleted) {
        setEditSkuError(`SKU "${editSku.trim()}" already used by another product`);
      } else {
        setEditSkuError(null);
      }
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [editSku, editingProductId, db]);

  const openEdit = (p: ProductDoc) => {
    setEditingProductId(p.id);
    setEditName(p.name);
    setEditSku(p.sku);
    setEditCategory(p.category);
    setEditRetailPrice(String(p.retailPrice));
    setEditWholesalePrice(String(p.wholesalePrice));
    setEditCostPrice(String(p.costPrice));
    setEditStock(String(p.stock));
    setEditMinStockLevel(String(p.minStockLevel));
    setEditBarcode(p.barcode ?? '');
    setEditSkuError(null);
    setEditRetailPriceError(null);
    setEditCostPriceError(null);
    setEditStockError(null);
    setEditMinStockLevelError(null);
  };

  const cancelEdit = () => {
    setEditingProductId(null);
    setEditName('');
    setEditSku('');
    setEditCategory('');
    setEditRetailPrice('');
    setEditWholesalePrice('');
    setEditCostPrice('');
    setEditStock('');
    setEditMinStockLevel('');
    setEditBarcode('');
    setEditSkuError(null);
    setEditRetailPriceError(null);
    setEditCostPriceError(null);
    setEditStockError(null);
    setEditMinStockLevelError(null);
  };

  // Validation helpers
  const validatePrice = (value: string, fieldName: string): string | null => {
    if (!value.trim()) return null; // Allow empty for optional fields
    const num = parseFloat(value);
    if (isNaN(num)) return `${fieldName} must be a number`;
    if (num < 0) return `${fieldName} cannot be negative`;
    return null;
  };

  const validateStock = (value: string): string | null => {
    if (!value.trim()) return null; // Allow empty
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'Stock must be a whole number';
    if (num < 0) return 'Stock cannot be negative';
    if (num !== parseFloat(value)) return 'Stock must be a whole number';
    return null;
  };

  const validatePriceComparison = (retail: string, cost: string): { retailError: string | null; costError: string | null } => {
    const retailNum = parseFloat(retail);
    const costNum = parseFloat(cost);
    if (!isNaN(retailNum) && !isNaN(costNum) && retailNum < costNum) {
      return { retailError: 'Retail price should be ≥ cost price', costError: null };
    }
    return { retailError: null, costError: null };
  };

  const saveEdit = async () => {
    if (!db || !editingProductId) return;
    if (editSkuError || editRetailPriceError || editCostPriceError || editStockError || editMinStockLevelError) {
      setMessage('Please fix validation errors before saving.');
      return;
    }
    const rp = parseFloat(editRetailPrice);
    const wp = parseFloat(editWholesalePrice);
    const cp = parseFloat(editCostPrice);
    const st = parseInt(editStock, 10);
    const minSt = parseInt(editMinStockLevel, 10);
    if (Number.isNaN(rp) || rp < 0 || Number.isNaN(cp) || cp < 0) {
      setMessage('Enter valid cost and retail prices.');
      return;
    }
    if (!editName.trim()) {
      setMessage('Name is required.');
      return;
    }
    setEditSaving(true);
    setMessage(null);
    try {
      const doc = await db.products.findOne(editingProductId).exec();
      if (!doc) return;
      await doc.patch({
        name: editName.trim(),
        sku: editSku.trim() || doc.sku,
        category: editCategory.trim() || 'General',
        retailPrice: rp,
        wholesalePrice: Number.isNaN(wp) ? rp : Math.max(0, wp),
        costPrice: cp,
        stock: Number.isNaN(st) ? doc.stock : Math.max(0, st),
        minStockLevel: Number.isNaN(minSt) ? 0 : Math.max(0, minSt),
        barcode: editBarcode.trim() || undefined,
      });
      triggerImmediateSync('products');
      setMessage('Product updated.');
      setTimeout(() => setMessage(null), 3000);
      cancelEdit();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    const rp = parseFloat(retailPrice);
    const cp = parseFloat(costPrice);
    const st = parseInt(stock, 10);
    const minSt = parseInt(minStockLevel, 10);
    if (Number.isNaN(rp) || Number.isNaN(cp) || rp < 0 || cp < 0) {
      setMessage('Enter valid prices.');
      return;
    }
    if (!name.trim()) {
      setMessage('Name is required.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const finalSku = sku.trim() || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      // Check for duplicate SKU
      if (finalSku) {
        const existingBySku = await db.products.findOne({ selector: { sku: finalSku } }).exec();
        if (existingBySku && !(existingBySku as { _deleted?: boolean })._deleted) {
          setMessage(`SKU "${finalSku}" already exists. Please use a different SKU.`);
          setSaving(false);
          return;
        }
      }

      const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.products.insert({
        id,
        sku: finalSku,
        name: name.trim(),
        category: category.trim() || 'General',
        retailPrice: rp,
        wholesalePrice: rp,
        costPrice: cp,
        stock: Number.isNaN(st) ? 0 : Math.max(0, st),
        minStockLevel: Number.isNaN(minSt) ? 0 : Math.max(0, minSt),
        supplierId: supplierId || undefined,
      });
      setSku('');
      setName('');
      setCategory('');
      setRetailPrice('');
      setCostPrice('');
      setStock('');
      setMinStockLevel('0');
      setSupplierId('');
      setMessage('Product added.');
      triggerImmediateSync('products');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  const addStock = async (productId: string) => {
    if (!db) return;
    const qty = parseInt(String(addStockQty).trim(), 10);
    if (Number.isNaN(qty) || qty <= 0) {
      setMessage('Enter a quantity (e.g. 1 or more).');
      return;
    }
    const doc = await db.products.findOne(productId).exec();
    if (!doc) return;
    const supplierIdForCredit = (addStockSupplierId || doc.supplierId || '').trim();
    if (addStockPayment === 'credit' && !supplierIdForCredit) {
      setMessage('Select a supplier when adding stock on credit.');
      return;
    }
    const costTotal = doc.costPrice * qty;
    const productName = doc.name;
    // Ensure proper number conversion: handle null, undefined, string, or number
    const currentStock = doc.stock != null ? Number(doc.stock) : 0;
    if (isNaN(currentStock)) {
      setMessage('Invalid stock value. Please refresh and try again.');
      return;
    }
    const newStock = currentStock + qty;
    await doc.patch({ stock: Math.max(0, Math.round(newStock)) });

    const today = getTodayInAppTz();
    if (addStockPayment === 'cash') {
      const expenseId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.expenses.insert({
        id: expenseId,
        date: today,
        itemBought: productName,
        purpose: 'Inventory purchase',
        amount: costTotal,
        paidBy: 'Cash',
        receiptAttached: false,
        paidByWho: 'POS',
      });
    } else {
      const ledgerId = `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.supplier_ledger.insert({
        id: ledgerId,
        supplierId: supplierIdForCredit,
        type: 'credit',
        amount: costTotal,
        date: today,
        note: `Stock: ${productName} (×${qty})`,
      });
    }

    triggerImmediateSync('products');
    setAddStockFor(null);
    setAddStockQty('');
    setAddStockPayment('cash');
    setAddStockSupplierId('');
    setMessage(`Stock added. ${addStockPayment === 'cash' ? 'Deducted from opening cash.' : 'Added to supplier credit.'}`);
  };

  const setProductSupplier = async (productId: string, newSupplierId: string) => {
    if (!db) return;
    const doc = await db.products.findOne(productId).exec();
    if (!doc) return;
    await doc.patch({ supplierId: newSupplierId || undefined });
    triggerImmediateSync('products');
  };

  if (!db) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Loading database…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="page-title">Inventory</h1>
        <Link to="/" className="btn-secondary inline-flex w-fit text-sm">
          ← Dashboard
        </Link>
      </div>

      {products.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card flex items-center gap-4 p-4">
            <div className="rounded-lg bg-slate-100 p-2">
              <Package className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Inventory value (cost)</p>
              <p className="text-xl font-bold text-smoky-black">{formatUGX(valuationCost)}</p>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-4">
            <div className="rounded-lg bg-emerald-100 p-2">
              <Package className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Inventory value (retail)</p>
              <p className="text-xl font-bold text-emerald-700">{formatUGX(valuationRetail)}</p>
            </div>
          </div>
        </div>
      )}

      {showRetailBelowCostWarning && (
        <div className="card flex gap-3 border-amber-200 bg-amber-50 p-4" role="alert">
          <div className="shrink-0 rounded-lg bg-amber-100 p-2">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-amber-800">
              Retail value is below cost — some products are priced at or below cost.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              {productsWithRetailAtOrBelowCost.length === 1
                ? '1 product has retail price ≤ cost price. Update it so retail is higher than cost to improve margin.'
                : `${productsWithRetailAtOrBelowCost.length} products have retail price ≤ cost price. Update them so retail is higher than cost to improve margin.`}
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
              {productsWithRetailAtOrBelowCost.map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{p.name}</span>
                  {p.sku && <span className="text-amber-700"> ({p.sku})</span>} — cost{' '}
                  {formatUGX(p.costPrice)}, retail {formatUGX(p.retailPrice)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <section className="card p-4 sm:p-5">
          <h2 className="mb-4 font-heading text-lg font-semibold text-smoky-black">Add product</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <input
                type="text"
                placeholder="SKU (optional)"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className={`input-base ${skuError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {skuError && <p className="mt-1 text-xs text-red-600">{skuError}</p>}
            </div>
            <input type="text" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} required className="input-base" />
            <input type="text" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} className="input-base" />
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Supplier (optional)</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="input-base"
              >
                <option value="">None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="number"
                placeholder="Retail price (UGX)"
                value={retailPrice}
                onChange={(e) => {
                  const val = e.target.value;
                  setRetailPrice(val);
                  const error = validatePrice(val, 'Retail price');
                  setRetailPriceError(error);
                  if (!error && costPrice) {
                    const comp = validatePriceComparison(val, costPrice);
                    setRetailPriceError(comp.retailError);
                  }
                }}
                min="0"
                step="1"
                className={`input-base ${retailPriceError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {retailPriceError && <p className="mt-1 text-xs text-red-600">{retailPriceError}</p>}
            </div>
            <div>
              <input
                type="number"
                placeholder="Cost price (UGX)"
                value={costPrice}
                onChange={(e) => {
                  const val = e.target.value;
                  setCostPrice(val);
                  const error = validatePrice(val, 'Cost price');
                  setCostPriceError(error);
                  if (!error && retailPrice) {
                    const comp = validatePriceComparison(retailPrice, val);
                    setRetailPriceError(comp.retailError);
                  }
                }}
                min="0"
                step="1"
                className={`input-base ${costPriceError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {costPriceError && <p className="mt-1 text-xs text-red-600">{costPriceError}</p>}
            </div>
            <div>
              <input
                type="number"
                placeholder="Stock"
                value={stock}
                onChange={(e) => {
                  const val = e.target.value;
                  setStock(val);
                  setStockError(validateStock(val));
                }}
                min="0"
                step="1"
                className={`input-base ${stockError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {stockError && <p className="mt-1 text-xs text-red-600">{stockError}</p>}
            </div>
            <div>
              <input
                type="number"
                placeholder="Min stock level"
                value={minStockLevel}
                onChange={(e) => {
                  const val = e.target.value;
                  setMinStockLevel(val);
                  setMinStockLevelError(validateStock(val));
                }}
                min="0"
                step="1"
                className={`input-base ${minStockLevelError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
              />
              {minStockLevelError && <p className="mt-1 text-xs text-red-600">{minStockLevelError}</p>}
            </div>
            <button
              type="submit"
              disabled={saving || !!skuError || !!retailPriceError || !!costPriceError || !!stockError || !!minStockLevelError}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Add product'}
            </button>
          </form>
          {message && (
            <p className={`mt-2 text-sm ${message.startsWith('Product added') || message.startsWith('Stock added') ? 'text-emerald-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="border-b border-slate-200/80 bg-slate-50/50 px-5 py-4 font-heading text-lg font-semibold text-smoky-black">
            Products & stock
          </h2>
          <div className="border-b border-slate-100 px-4 py-3">
            <label htmlFor="inventory-product-search" className="sr-only">Search products</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                id="inventory-product-search"
                type="search"
                placeholder="Search by name, SKU, category, barcode…"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="input-base w-full pl-9 pr-3 py-2 text-sm"
                autoComplete="off"
              />
            </div>
            {productSearch.trim() && (
              <p className="mt-1.5 text-xs text-slate-500">
                Showing {filteredProducts.length} of {products.length} products
              </p>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {products.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No products. Add one with the form.</p>
            ) : filteredProducts.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No products match &quot;{productSearch.trim()}&quot;. Try a different search.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredProducts.map((p) => (
                  <li
                    key={p.id}
                    className={`px-4 py-3 transition hover:bg-slate-50/50 ${p.stock <= p.minStockLevel ? 'bg-amber-50/50' : ''}`}
                  >
                    {editingProductId === p.id ? (
                      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-600">Edit product</span>
                          <button type="button" onClick={cancelEdit} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cancel">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input type="text" placeholder="Name *" value={editName} onChange={(e) => setEditName(e.target.value)} className="input-base text-sm" />
                          <div>
                            <input type="text" placeholder="SKU" value={editSku} onChange={(e) => setEditSku(e.target.value)} className={`input-base text-sm ${editSkuError ? 'border-red-300' : ''}`} />
                            {editSkuError && <p className="mt-0.5 text-xs text-red-600">{editSkuError}</p>}
                          </div>
                          <input type="text" placeholder="Category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="input-base text-sm" />
                          <input type="text" placeholder="Barcode" value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} className="input-base text-sm" />
                          <div>
                            <input
                              type="number"
                              placeholder="Cost price (UGX)"
                              value={editCostPrice}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditCostPrice(val);
                                const error = validatePrice(val, 'Cost price');
                                setEditCostPriceError(error);
                                if (!error && editRetailPrice) {
                                  const comp = validatePriceComparison(editRetailPrice, val);
                                  setEditRetailPriceError(comp.retailError);
                                }
                              }}
                              min="0"
                              step="1"
                              className={`input-base text-sm ${editCostPriceError ? 'border-red-300' : ''}`}
                            />
                            {editCostPriceError && <p className="mt-0.5 text-xs text-red-600">{editCostPriceError}</p>}
                          </div>
                          <div>
                            <input
                              type="number"
                              placeholder="Retail price (UGX)"
                              value={editRetailPrice}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditRetailPrice(val);
                                const error = validatePrice(val, 'Retail price');
                                setEditRetailPriceError(error);
                                if (!error && editCostPrice) {
                                  const comp = validatePriceComparison(val, editCostPrice);
                                  setEditRetailPriceError(comp.retailError);
                                }
                              }}
                              min="0"
                              step="1"
                              className={`input-base text-sm ${editRetailPriceError ? 'border-red-300' : ''}`}
                            />
                            {editRetailPriceError && <p className="mt-0.5 text-xs text-red-600">{editRetailPriceError}</p>}
                          </div>
                          <div>
                            <input
                              type="number"
                              placeholder="Wholesale price (UGX)"
                              value={editWholesalePrice}
                              onChange={(e) => setEditWholesalePrice(e.target.value)}
                              min="0"
                              step="1"
                              className="input-base text-sm"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              placeholder="Stock"
                              value={editStock}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditStock(val);
                                setEditStockError(validateStock(val));
                              }}
                              min="0"
                              step="1"
                              className={`input-base text-sm ${editStockError ? 'border-red-300' : ''}`}
                            />
                            {editStockError && <p className="mt-0.5 text-xs text-red-600">{editStockError}</p>}
                          </div>
                          <div>
                            <input
                              type="number"
                              placeholder="Min stock level"
                              value={editMinStockLevel}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditMinStockLevel(val);
                                setEditMinStockLevelError(validateStock(val));
                              }}
                              min="0"
                              step="1"
                              className={`input-base text-sm ${editMinStockLevelError ? 'border-red-300' : ''}`}
                            />
                            {editMinStockLevelError && <p className="mt-0.5 text-xs text-red-600">{editMinStockLevelError}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={editSaving || !!editSkuError || !!editRetailPriceError || !!editCostPriceError || !!editStockError || !!editMinStockLevelError}
                            className="btn-primary py-1.5 text-sm disabled:opacity-50"
                          >
                            {editSaving ? 'Saving…' : 'Save changes'}
                          </button>
                          <button type="button" onClick={cancelEdit} className="btn-secondary py-1.5 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-smoky-black">{p.name}</p>
                        <p className="text-sm text-slate-600">
                          {p.sku} · {p.category}
                          {suppliers.find((s) => s.id === p.supplierId) && (
                            <span className="ml-1 text-slate-500">
                              · {suppliers.find((s) => s.id === p.supplierId)?.name}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${p.stock <= p.minStockLevel ? 'text-amber-700' : ''}`}>
                          Stock: {p.stock}
                          {p.stock <= p.minStockLevel && (
                            <span className="ml-1 text-amber-600">(low)</span>
                          )}
                        </span>
                        <span className="text-slate-500">{formatUGX(p.retailPrice)}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-tufts-blue"
                        title="Edit product details"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      {addStockFor === p.id ? (
                        <>
                          <div>
                            <input
                              type="number"
                              min={1}
                              placeholder="e.g. 5"
                              value={addStockQty}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAddStockQty(val);
                                if (!val.trim()) {
                                  setAddStockQtyError(null);
                                  return;
                                }
                                const num = parseInt(val, 10);
                                if (isNaN(num)) {
                                  setAddStockQtyError('Must be a whole number');
                                } else if (num <= 0) {
                                  setAddStockQtyError('Must be greater than 0');
                                } else if (num !== parseFloat(val)) {
                                  setAddStockQtyError('Must be a whole number');
                                } else {
                                  setAddStockQtyError(null);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !addStockQtyError) addStock(p.id);
                                if (e.key === 'Escape') {
                                  setAddStockFor(null);
                                  setAddStockQty('');
                                  setAddStockQtyError(null);
                                }
                              }}
                              className={`input-base w-24 py-1 text-center text-sm ${addStockQtyError ? 'border-red-300' : ''}`}
                              autoFocus
                              aria-label="Quantity to add"
                            />
                            {addStockQtyError && <p className="mt-0.5 text-xs text-red-600">{addStockQtyError}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-slate-600">Pay:</span>
                            <label className="flex cursor-pointer items-center gap-1 text-sm">
                              <input
                                type="radio"
                                name={`payment-${p.id}`}
                                checked={addStockPayment === 'cash'}
                                onChange={() => setAddStockPayment('cash')}
                                className="h-3.5 w-3.5"
                              />
                              Cash
                            </label>
                            <label className="flex cursor-pointer items-center gap-1 text-sm">
                              <input
                                type="radio"
                                name={`payment-${p.id}`}
                                checked={addStockPayment === 'credit'}
                                onChange={() => setAddStockPayment('credit')}
                                className="h-3.5 w-3.5"
                              />
                              Credit
                            </label>
                            {addStockPayment === 'credit' && (
                              <select
                                value={addStockSupplierId || p.supplierId || ''}
                                onChange={(e) => setAddStockSupplierId(e.target.value)}
                                className="input-base max-w-[140px] py-1 text-xs"
                                title="Supplier (required for credit)"
                              >
                                <option value="">Select supplier</option>
                                {suppliers.map((s) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => addStock(p.id)}
                            disabled={!!addStockQtyError || !addStockQty.trim()}
                            className="btn-primary py-1 text-sm disabled:opacity-50"
                          >
                            Add
                          </button>
                          <button type="button" onClick={() => { setAddStockFor(null); setAddStockQty(''); setAddStockPayment('cash'); setAddStockSupplierId(''); }} className="btn-secondary py-1 text-sm">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddStockFor(p.id);
                            setAddStockQty('');
                            setAddStockPayment('cash');
                            setAddStockSupplierId(p.supplierId || '');
                          }}
                          className="text-sm font-medium text-tufts-blue hover:underline"
                        >
                          + Add stock
                        </button>
                      )}
                      <select
                        value={p.supplierId ?? ''}
                        onChange={(e) => setProductSupplier(p.id, e.target.value)}
                        className="input-base w-auto py-1 text-xs"
                        title="Supplier"
                      >
                        <option value="">No supplier</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
