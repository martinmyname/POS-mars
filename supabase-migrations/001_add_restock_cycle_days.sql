-- Smart Restock Planner: add restock cycle days to products (run in Supabase SQL Editor)
-- Default 14 = number of days each restock should cover.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "restockCycleDays" integer DEFAULT 14;
