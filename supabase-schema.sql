-- Mars Kitchen Essentials – Supabase tables for RxDB replication
-- Run in Supabase SQL Editor. Enable Realtime for each table.
-- Column names match RxDB (camelCase) using quoted identifiers.

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  "id" text PRIMARY KEY,
  "sku" text NOT NULL,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "retailPrice" double precision NOT NULL,
  "wholesalePrice" double precision NOT NULL,
  "costPrice" double precision NOT NULL,
  "stock" integer NOT NULL DEFAULT 0,
  "minStockLevel" integer NOT NULL DEFAULT 10,
  "reorderLevel" integer,
  "maxStockLevel" integer,
  "imageUrl" text,
  "barcode" text,
  "supplierId" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Create unique indexes for SKU and barcode (only for non-deleted items)
-- Note: Supabase doesn't support partial unique indexes directly, so we'll handle uniqueness in application logic
-- But we can add indexes for performance
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique ON public.products ("sku") WHERE "_deleted" = false;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique ON public.products ("barcode") WHERE "_deleted" = false AND "barcode" IS NOT NULL;

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  "id" text PRIMARY KEY,
  "channel" text NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "items" jsonb NOT NULL,
  "total" double precision NOT NULL,
  "grossProfit" double precision NOT NULL,
  "paymentMethod" text NOT NULL,
  "paymentSplits" jsonb,
  "customer" jsonb,
  "customerId" text,
  "promotionId" text,
  "orderType" text,
  "linkedOrderId" text,
  "depositAmount" double precision,
  "numberOfDeposits" integer,
  "notes" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  "id" text PRIMARY KEY,
  "date" text NOT NULL,
  "itemBought" text NOT NULL,
  "purpose" text NOT NULL,
  "amount" double precision NOT NULL,
  "paidBy" text NOT NULL,
  "receiptAttached" boolean NOT NULL,
  "paidByWho" text NOT NULL,
  "notes" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Stock adjustments table
CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  "id" text PRIMARY KEY,
  "productId" text NOT NULL,
  "type" text NOT NULL,
  "quantity" integer NOT NULL,
  "reason" text,
  "date" text NOT NULL,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Report notes table
CREATE TABLE IF NOT EXISTS public.report_notes (
  "id" text PRIMARY KEY,
  "periodType" text NOT NULL,
  "periodStart" text NOT NULL,
  "comment" text NOT NULL,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Promotions table
CREATE TABLE IF NOT EXISTS public.promotions (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "type" text NOT NULL,
  "value" double precision NOT NULL,
  "startDate" text NOT NULL,
  "endDate" text,
  "active" boolean NOT NULL DEFAULT true,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Customers table
CREATE TABLE IF NOT EXISTS public.customers (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "address" text,
  "createdAt" text NOT NULL,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Deliveries table
CREATE TABLE IF NOT EXISTS public.deliveries (
  "id" text PRIMARY KEY,
  "customerName" text NOT NULL,
  "customerPhone" text NOT NULL,
  "address" text NOT NULL,
  "amountToCollect" double precision NOT NULL,
  "paymentStatus" text NOT NULL,
  "deliveryStatus" text NOT NULL,
  "orderId" text,
  "notes" text,
  "createdAt" text NOT NULL,
  "deliveredAt" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "contact" text,
  "phone" text,
  "email" text,
  "address" text,
  "notes" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Supplier ledger table
CREATE TABLE IF NOT EXISTS public.supplier_ledger (
  "id" text PRIMARY KEY,
  "supplierId" text NOT NULL,
  "type" text NOT NULL,
  "amount" double precision NOT NULL,
  "date" text NOT NULL,
  "dueDate" text,
  "note" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_adjustments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.promotions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_ledger;

-- Row Level Security (RLS) Policies
-- Allow authenticated users to read/write all data
-- Adjust these policies based on your security requirements

-- Products policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to products"
  ON public.products FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Orders policies
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to orders"
  ON public.orders FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Expenses policies
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to expenses"
  ON public.expenses FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Stock adjustments policies
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to stock_adjustments"
  ON public.stock_adjustments FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Report notes policies
ALTER TABLE public.report_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to report_notes"
  ON public.report_notes FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Promotions policies
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to promotions"
  ON public.promotions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Customers policies
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to customers"
  ON public.customers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Deliveries policies
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to deliveries"
  ON public.deliveries FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Suppliers policies
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to suppliers"
  ON public.suppliers FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Supplier ledger policies
ALTER TABLE public.supplier_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users full access to supplier_ledger"
  ON public.supplier_ledger FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
