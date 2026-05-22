-- =====================================================================
-- Linkhexa Partner API network tables (Earnytics)
-- =====================================================================

CREATE TABLE IF NOT EXISTS linkhexa_programmes (
  id                 BIGSERIAL PRIMARY KEY,
  programme_id       TEXT        NOT NULL UNIQUE,
  name               TEXT        NOT NULL,
  description        TEXT,
  display_url        TEXT,
  logo_url           TEXT,
  click_through_url  TEXT,
  currency_code      TEXT,
  programme_status   TEXT        DEFAULT 'Active',
  primary_region     TEXT,
  country_code       TEXT,
  valid_domains      JSONB,
  raw                JSONB,
  fetched_at         TIMESTAMPTZ DEFAULT NOW(),
  -- Cached from Linkhexa GET /api/v1/brands/{id} (24h)
  commission_summary   TEXT,
  commission_type      TEXT,
  epc                  TEXT,
  conversion_rate      TEXT,
  validation_days      INTEGER,
  deeplink_enabled     BOOLEAN,
  commission_fetched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS linkhexa_programmes_status_idx ON linkhexa_programmes(programme_status);
CREATE INDEX IF NOT EXISTS linkhexa_programmes_name_idx   ON linkhexa_programmes USING gin(to_tsvector('english', name));

CREATE TABLE IF NOT EXISTS linkhexa_transactions (
  id                  BIGSERIAL PRIMARY KEY,
  linkhexa_txn_id     TEXT        UNIQUE,
  programme_id        TEXT,
  programme_name      TEXT,
  sale_amount         NUMERIC     DEFAULT 0,
  commission_amount   NUMERIC     DEFAULT 0,
  currency            TEXT        DEFAULT 'USD',
  transaction_date    TIMESTAMPTZ,
  status              TEXT,
  click_ref           TEXT,
  publisher_id        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  go_link_slug        TEXT,
  raw                 JSONB,
  synced_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS linkhexa_transactions_programme_idx  ON linkhexa_transactions(programme_id);
CREATE INDEX IF NOT EXISTS linkhexa_transactions_publisher_idx  ON linkhexa_transactions(publisher_id);
CREATE INDEX IF NOT EXISTS linkhexa_transactions_click_ref_idx  ON linkhexa_transactions(click_ref);
CREATE INDEX IF NOT EXISTS linkhexa_transactions_status_idx     ON linkhexa_transactions(status);
CREATE INDEX IF NOT EXISTS linkhexa_transactions_date_idx       ON linkhexa_transactions(transaction_date);

CREATE TABLE IF NOT EXISTS publisher_linkhexa_applications (
  id           BIGSERIAL PRIMARY KEY,
  publisher_id UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  programme_id TEXT  NOT NULL,
  status       TEXT  NOT NULL DEFAULT 'pending',
  applied_at   TIMESTAMPTZ    DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  notes        TEXT,
  UNIQUE(publisher_id, programme_id)
);

CREATE INDEX IF NOT EXISTS pub_lh_apps_publisher_idx ON publisher_linkhexa_applications(publisher_id);
CREATE INDEX IF NOT EXISTS pub_lh_apps_status_idx    ON publisher_linkhexa_applications(status);

CREATE TABLE IF NOT EXISTS linkhexa_sync_state (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  last_completed_at TIMESTAMPTZ,
  last_error        TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO linkhexa_sync_state(id) VALUES ('default') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS linkhexa_publisher_earnings_daily (
  id           BIGSERIAL PRIMARY KEY,
  publisher_id UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  programme_id TEXT    NOT NULL,
  date         DATE    NOT NULL,
  conversions  INT     DEFAULT 0,
  commission   NUMERIC DEFAULT 0,
  sale_amount  NUMERIC DEFAULT 0,
  currency     TEXT    DEFAULT 'USD',
  UNIQUE(publisher_id, programme_id, date)
);

CREATE OR REPLACE FUNCTION refresh_linkhexa_publisher_earnings_daily()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM linkhexa_publisher_earnings_daily;
  INSERT INTO linkhexa_publisher_earnings_daily
    (publisher_id, programme_id, date, conversions, commission, sale_amount, currency)
  SELECT
    t.publisher_id,
    t.programme_id,
    DATE(t.transaction_date),
    COUNT(*)::INT,
    SUM(t.commission_amount),
    SUM(t.sale_amount),
    MAX(COALESCE(t.currency,'USD'))
  FROM linkhexa_transactions t
  WHERE t.publisher_id IS NOT NULL
    AND t.programme_id IS NOT NULL
    AND t.transaction_date IS NOT NULL
  GROUP BY t.publisher_id, t.programme_id, DATE(t.transaction_date);
END;
$$;

ALTER TABLE publisher_go_links
  DROP CONSTRAINT IF EXISTS publisher_go_links_network_check;
ALTER TABLE publisher_go_links
  ADD CONSTRAINT publisher_go_links_network_check
  CHECK (network IN ('impact','tradetracker','paidonresults','yieldkit','admitad','linkhexa'));

ALTER TABLE linkhexa_programmes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkhexa_transactions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_linkhexa_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkhexa_publisher_earnings_daily   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access linkhexa_programmes"
  ON linkhexa_programmes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read linkhexa_programmes"
  ON linkhexa_programmes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access linkhexa_transactions"
  ON linkhexa_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Publisher reads own linkhexa_transactions"
  ON linkhexa_transactions FOR SELECT TO authenticated
  USING (publisher_id = auth.uid());

CREATE POLICY "Service role full access pub_linkhexa_apps"
  ON publisher_linkhexa_applications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Publisher manages own linkhexa_apps"
  ON publisher_linkhexa_applications FOR ALL TO authenticated
  USING (publisher_id = auth.uid()) WITH CHECK (publisher_id = auth.uid());

CREATE POLICY "Service role full access linkhexa_earnings"
  ON linkhexa_publisher_earnings_daily FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Publisher reads own linkhexa_earnings"
  ON linkhexa_publisher_earnings_daily FOR SELECT TO authenticated
  USING (publisher_id = auth.uid());
