-- Add orderNumber and scheduledFor to orders table (easy tracking + scheduled orders/reminders)
-- Run once in Supabase SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'orderNumber') THEN
    ALTER TABLE public.orders ADD COLUMN "orderNumber" integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'scheduledFor') THEN
    ALTER TABLE public.orders ADD COLUMN "scheduledFor" text;
  END IF;
END $$;
