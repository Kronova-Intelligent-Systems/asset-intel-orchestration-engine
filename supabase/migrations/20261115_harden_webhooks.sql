-- Webhook hardening: enforce https URLs and non-empty events at the database layer,
-- and stop signed-in users from reassigning ownership or overwriting the signing secret.
--
-- Safe to re-run. Runs as a single transaction: if any existing row violates the new
-- rules the migration aborts with a message and nothing is changed.

DO $$
DECLARE
  bad_urls integer;
  bad_events integer;
BEGIN
  SELECT count(*) INTO bad_urls FROM webhooks WHERE url !~* '^https://';
  SELECT count(*) INTO bad_events FROM webhooks WHERE cardinality(events) = 0;

  IF bad_urls > 0 OR bad_events > 0 THEN
    RAISE EXCEPTION
      'Existing webhooks violate the new rules (% non-https urls, % empty event lists). Fix or delete them first: SELECT id, url, events FROM webhooks WHERE url !~* ''^https://'' OR cardinality(events) = 0;',
      bad_urls, bad_events;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_url_https_check' AND conrelid = 'public.webhooks'::regclass) THEN
    ALTER TABLE webhooks ADD CONSTRAINT webhooks_url_https_check CHECK (url ~* '^https://');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhooks_events_not_empty_check' AND conrelid = 'public.webhooks'::regclass) THEN
    ALTER TABLE webhooks ADD CONSTRAINT webhooks_events_not_empty_check CHECK (cardinality(events) > 0);
  END IF;
END $$;

-- Only the server (service role) or direct SQL access may change user_id or secret.
CREATE OR REPLACE FUNCTION protect_webhook_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.secret IS DISTINCT FROM OLD.secret THEN
      RAISE EXCEPTION 'user_id and secret cannot be modified';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_webhook_immutable_columns_trigger ON webhooks;
CREATE TRIGGER protect_webhook_immutable_columns_trigger
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION protect_webhook_immutable_columns();

-- webhook_logs are written only by the server (service role); users get read access via the
-- existing SELECT policy. Restrict the user-update policy so it also checks the new row.
DROP POLICY IF EXISTS "Users can update their own webhooks" ON webhooks;
CREATE POLICY "Users can update their own webhooks"
  ON webhooks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
