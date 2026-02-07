-- Add missing columns to deliveries table (fixes 400 Bad Request on PATCH/POST)
-- Run this once in Supabase SQL Editor if your deliveries table was created without these columns.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'riderName') THEN
    ALTER TABLE public.deliveries ADD COLUMN "riderName" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'motorcycleId') THEN
    ALTER TABLE public.deliveries ADD COLUMN "motorcycleId" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'paymentReceivedAt') THEN
    ALTER TABLE public.deliveries ADD COLUMN "paymentReceivedAt" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'paymentReceivedAmount') THEN
    ALTER TABLE public.deliveries ADD COLUMN "paymentReceivedAmount" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deliveries' AND column_name = 'paymentReceivedBy') THEN
    ALTER TABLE public.deliveries ADD COLUMN "paymentReceivedBy" text;
  END IF;
END $$;
