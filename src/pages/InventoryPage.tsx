import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRxDB } from '@/hooks/useRxDB';
import { formatUGX } from '@/lib/formatUGX';
import { Package } from 'lucide-react';

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
  const [wholesalePrice, setWholesalePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [addStockFor, setAddStockFor] = useState<string | null>(null);
  const [addStockQty, setAddStockQty] = useState('');

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

  const valuationCost = products.reduce((s, p) => s + p.stock * p.costPrice, 0);
  const valuationRetail = products.reduce((s, p) => s + p.stock * p.retailPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    const rp = parseFloat(retailPrice);
    const wp = parseFloat(wholesalePrice);
    const cp = parseFloat(costPrice);
    const st = parseInt(stock, 10);
    const minSt = parseInt(minStockLevel, 10);
    if (Number.isNaN(rp) || Number.isNaN(wp) || Number.isNaN(cp) || rp < 0 || wp < 0 || cp < 0) {
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
      const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      await db.products.insert({
        id,
        sku: sku.trim() || id,
        name: name.trim(),
        category: category.trim() || 'General',
        barcode: barcode.trim() || undefined,
        retailPrice: rp,
        wholesalePrice: wp,
        costPrice: cp,
        stock: Number.isNaN(st) ? 0 : Math.max(0, st),
        minStockLevel: Number.isNaN(minSt) ? 0 : Math.max(0, minSt),
        supplierId: supplierId || undefined,
      });
      setSku('');
      setName('');
      setCategory('');
      setBarcode('');
      setRetailPrice('');
      setWholesalePrice('');
      setCostPrice('');
      setStock('');
      setMinStockLevel('0');
      setSupplierId('');
      setMessage('Product added.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  const addStock = async (productId: string) => {
    if (!db) return;
    const qty = parseInt(addStockQty, 10);
    if (Number.isNaN(qty) || qty <= 0) return;
    const doc = await db.products.findOne(productId).exec();
    if (!doc) return;
    const newStock = doc.stock + qty;
    await doc.patch({ stock: newStock });
    setAddStockFor(null);
    setAddStockQty('');
  };

  const setProductSupplier = async (productId: string, newSupplierId: string) => {
    if (!db) return;
    const doc = await db.products.findOne(productId).exec();
    if (!doc) return;
    await doc.patch({ supplierId: newSupplierId || undefined });
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
        <h1 className="font-heading text-2xl font-bold tracking-tight text-smoky-black">Inventory</h1>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-heading text-lg font-semibold text-smoky-black">Add product</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input type="text" placeholder="SKU (optional)" value={sku} onChange={(e) => setSku(e.target.value)} className="input-base" />
            <input type="text" placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} required className="input-base" />
            <input type="text" placeholder="Barcode (for scanner)" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="input-base" />
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
            <input type="number" placeholder="Retail price (UGX)" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} min="0" step="1" className="input-base" />
            <input type="number" placeholder="Wholesale price (UGX)" value={wholesalePrice} onChange={(e) => setWholesalePrice(e.target.value)} min="0" step="1" className="input-base" />
            <input type="number" placeholder="Cost price (UGX)" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} min="0" step="1" className="input-base" />
            <input type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} min="0" step="1" className="input-base" />
            <input type="number" placeholder="Min stock level" value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} min="0" step="1" className="input-base" />
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? 'Saving…' : 'Add product'}
            </button>
          </form>
          {message && (
            <p className={`mt-2 text-sm ${message === 'Product added.' ? 'text-emerald-600' : 'text-red-600'}`}>
              {message}
            </p>
          )}
        </section>

        <section className="card overflow-hidden">
          <h2 className="mb-3 border-b border-slate-200/80 bg-slate-50/50 px-5 py-4 font-heading text-lg font-semibold text-smoky-black">
            Products & stock
          </h2>
          <div className="max-h-[60vh] overflow-y-auto">
            {products.length === 0 ? (
              <p className="p-6 text-center text-slate-500">No products. Add one with the form.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {products.map((p) => (
                  <li
                    key={p.id}
                    className={`px-4 py-3 transition hover:bg-slate-50/50 ${p.stock <= p.minStockLevel ? 'bg-amber-50/50' : ''}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-smoky-black">{p.name}</p>
                        <p className="text-sm text-slate-600">
                          {p.sku}
                          {p.barcode ? ` · ${p.barcode}` : ''} · {p.category}
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
                      {addStockFor === p.id ? (
                        <>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={addStockQty}
                            onChange={(e) => setAddStockQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addStock(p.id);
                              if (e.key === 'Escape') setAddStockFor(null);
                            }}
                            className="input-base w-20 py-1 text-center text-sm"
                            autoFocus
                          />
                          <button type="button" onClick={() => addStock(p.id)} className="btn-primary py-1 text-sm">
                            Add
                          </button>
                          <button type="button" onClick={() => { setAddStockFor(null); setAddStockQty(''); }} className="btn-secondary py-1 text-sm">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setAddStockFor(p.id); setAddStockQty(''); }}
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
