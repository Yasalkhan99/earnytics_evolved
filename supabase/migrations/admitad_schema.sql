-- =====================================================================
-- Admitad network tables
-- =====================================================================

-- Campaigns
CREATE TABLE IF NOT EXISTS admitad_campaigns (
  id               BIGSERIAL PRIMARY KEY,
  campaign_id      TEXT        NOT NULL UNIQUE,
  name             TEXT        NOT NULL,
  site_url         TEXT,
  logo_url         TEXT,
  status           TEXT        DEFAULT 'active',
  currency         TEXT,
  rating           TEXT,
  ecpc             NUMERIC,
  commission_type  TEXT,
  commission_rate  TEXT,
  regions          TEXT[],
  categories       TEXT[],
  allow_deeplink   BOOLEAN     DEFAULT FALSE,
  connected        BOOLEAN     DEFAULT FALSE,
  description      TEXT,
  raw              JSONB,
  fetched_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admitad_campaigns_status_idx ON admitad_campaigns(status);
CREATE INDEX IF NOT EXISTS admitad_campaigns_name_idx   ON admitad_campaigns USING gin(to_tsvector('english', name));

-- Transactions / actions
CREATE TABLE IF NOT EXISTS admitad_transactions (
  id               BIGSERIAL PRIMARY KEY,
  admitad_id       TEXT        UNIQUE,
  campaign_id      TEXT,
  campaign_name    TEXT,
  action           TEXT,
  status           TEXT,
  payment          NUMERIC     DEFAULT 0,
  currency         TEXT        DEFAULT 'USD',
  creation_date    TIMESTAMPTZ,
  close_date       TIMESTAMPTZ,
  subid            TEXT,
  publisher_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  go_link_slug     TEXT,
  raw              JSONB,
  synced_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admitad_transactions_campaign_idx   ON admitad_transactions(campaign_id);
CREATE INDEX IF NOT EXISTS admitad_transactions_publisher_idx  ON admitad_transactions(publisher_id);
CREATE INDEX IF NOT EXISTS admitad_transactions_subid_idx      ON admitad_transactions(subid);
CREATE INDEX IF NOT EXISTS admitad_transactions_status_idx     ON admitad_transactions(status);

-- Publisher applications
CREATE TABLE IF NOT EXISTS publisher_admitad_applications (
  id           BIGSERIAL PRIMARY KEY,
  publisher_id UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id  TEXT  NOT NULL,
  status       TEXT  NOT NULL DEFAULT 'pending',
  applied_at   TIMESTAMPTZ    DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  notes        TEXT,
  UNIQUE(publisher_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS pub_admitad_apps_publisher_idx ON publisher_admitad_applications(publisher_id);
CREATE INDEX IF NOT EXISTS pub_admitad_apps_status_idx    ON publisher_admitad_applications(status);

-- Sync state
CREATE TABLE IF NOT EXISTS admitad_sync_state (
  id                TEXT PRIMARY KEY DEFAULT 'default',
  last_completed_at TIMESTAMPTZ,
  last_error        TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO admitad_sync_state(id) VALUES ('default') ON CONFLICT DO NOTHING;

-- Daily rollup
CREATE TABLE IF NOT EXISTS admitad_publisher_earnings_daily (
  id           BIGSERIAL PRIMARY KEY,
  publisher_id UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id  TEXT    NOT NULL,
  date         DATE    NOT NULL,
  clicks       INT     DEFAULT 0,
  conversions  INT     DEFAULT 0,
  commission   NUMERIC DEFAULT 0,
  currency     TEXT    DEFAULT 'USD',
  UNIQUE(publisher_id, campaign_id, date)
);

CREATE OR REPLACE FUNCTION refresh_admitad_publisher_earnings_daily()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM admitad_publisher_earnings_daily;
  INSERT INTO admitad_publisher_earnings_daily
    (publisher_id, campaign_id, date, conversions, commission, currency)
  SELECT
    t.publisher_id,
    t.campaign_id,
    DATE(t.creation_date),
    COUNT(*)::INT,
    SUM(t.payment),
    MAX(COALESCE(t.currency,'USD'))
  FROM admitad_transactions t
  WHERE t.publisher_id IS NOT NULL
    AND t.creation_date IS NOT NULL
  GROUP BY t.publisher_id, t.campaign_id, DATE(t.creation_date);
END;
$$;

-- Update publisher_go_links network check constraint to include admitad
ALTER TABLE publisher_go_links
  DROP CONSTRAINT IF EXISTS publisher_go_links_network_check;
ALTER TABLE publisher_go_links
  ADD CONSTRAINT publisher_go_links_network_check
  CHECK (network IN ('impact','tradetracker','paidonresults','yieldkit','admitad'));

-- RLS
ALTER TABLE admitad_campaigns                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admitad_transactions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE publisher_admitad_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admitad_publisher_earnings_daily   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access admitad_campaigns"
  ON admitad_campaigns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated read admitad_campaigns"
  ON admitad_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access admitad_transactions"
  ON admitad_transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Publisher reads own admitad_transactions"
  ON admitad_transactions FOR SELECT TO authenticated
  USING (publisher_id = auth.uid());

CREATE POLICY "Service role full access pub_admitad_apps"
  ON publisher_admitad_applications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Publisher manages own admitad_apps"
  ON publisher_admitad_applications FOR ALL TO authenticated
  USING (publisher_id = auth.uid()) WITH CHECK (publisher_id = auth.uid());

CREATE POLICY "Service role full access admitad_earnings"
  ON admitad_publisher_earnings_daily FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Publisher reads own admitad_earnings"
  ON admitad_publisher_earnings_daily FOR SELECT TO authenticated
  USING (publisher_id = auth.uid());
