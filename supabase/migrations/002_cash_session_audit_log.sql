-- Audit log for cash session changes (opening edits, expected adjustments, notes, closing)
CREATE TABLE IF NOT EXISTS public.cash_session_audit_log (
  "id" text PRIMARY KEY,
  "sessionId" text NOT NULL,
  "changedAt" text NOT NULL,
  "changedBy" text NOT NULL,
  "field" text NOT NULL,
  "oldValue" text,
  "newValue" text,
  "reason" text,
  "_deleted" boolean NOT NULL DEFAULT false,
  "_modified" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cash_session_audit_log_session_id ON public.cash_session_audit_log ("sessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cash_session_audit_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_session_audit_log;
  END IF;
END $$;

DROP TRIGGER IF EXISTS cash_session_audit_log_set_modified ON public.cash_session_audit_log;
CREATE TRIGGER cash_session_audit_log_set_modified
  BEFORE UPDATE ON public.cash_session_audit_log
  FOR EACH ROW EXECUTE PROCEDURE public.set_modified_timestamp();

ALTER TABLE public.cash_session_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow authenticated users full access to cash_session_audit_log" ON public.cash_session_audit_log;
CREATE POLICY "Allow authenticated users full access to cash_session_audit_log"
  ON public.cash_session_audit_log FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
