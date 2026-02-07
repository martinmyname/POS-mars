-- Clear all data from Mars POS tables (for testing with real data).
-- Run in Supabase SQL Editor. This permanently deletes all rows.
-- Order: child-style tables first, then independent tables (no FKs in schema).

TRUNCATE TABLE public.supplier_ledger;
TRUNCATE TABLE public.stock_adjustments;
TRUNCATE TABLE public.deliveries;
TRUNCATE TABLE public.layaways;
TRUNCATE TABLE public.orders;
TRUNCATE TABLE public.expenses;
TRUNCATE TABLE public.report_notes;
TRUNCATE TABLE public.promotions;
TRUNCATE TABLE public.customers;
TRUNCATE TABLE public.products;
TRUNCATE TABLE public.suppliers;
TRUNCATE TABLE public.cash_sessions;
