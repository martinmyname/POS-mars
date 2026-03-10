-- Petty cash transactions (cash out from drawer during a session)
CREATE TABLE IF NOT EXISTS public.petty_cash_transactions (
  "id" text PRIMARY KEY,
  "sessionId" text NOT NULL,
  "amount" double precision NOT NULL,
  "reason" text NOT NULL,
  "recordedAt" text NOT NULL,
  "recordedBy" text NOT NULL,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS petty_cash_transactions_session_id ON public.petty_cash_transactions ("sessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'petty_cash_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.petty_cash_transactions;
  END IF;
END $$;

DROP TRIGGER IF EXISTS petty_cash_transactions_set_modified ON public.petty_cash_transactions;
CREATE TRIGGER petty_cash_transactions_set_modified
  BEFORE UPDATE ON public.petty_cash_transactions
  FOR EACH ROW EXECUTE PROCEDURE public.set_modified_timestamp();

ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to petty_cash_transactions" ON public.petty_cash_transactions;
CREATE POLICY "Allow authenticated users full access to petty_cash_transactions"
  ON public.petty_cash_transactions FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
