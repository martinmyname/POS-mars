-- Mars Kitchen Essentials – Supabase tables for RxDB replication
-- Run in Supabase SQL Editor. Enable Realtime for each table.
-- Column names match RxDB (camelCase) using quoted identifiers.

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
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

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
  "customer" jsonb,
  "depositAmount" double precision,
  "numberOfDeposits" integer,
  "notes" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.report_notes (
  "id" text PRIMARY KEY,
  "periodType" text NOT NULL,
  "periodStart" text NOT NULL,
  "comment" text NOT NULL,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_adjustments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_notes;
