-- ─────────────────────────────────────────────────────────────────────────────
-- Yieldkit Integration Schema
-- Run in Supabase SQL Editor (one block at a time if needed)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Campaigns cache (from Advertiser API)
CREATE TABLE IF NOT EXISTS public.yieldkit_campaigns (
  id                bigserial PRIMARY KEY,
  advertiser_id     text NOT NULL UNIQUE,        -- advertiserId from API
  name              text NOT NULL,               -- advertiserName
  url               text,                        -- advertiser website URL
  logo_url          text,                        -- logo / favicon
  country           text,                        -- primary geo
  status            text DEFAULT 'ACTIVE',       -- ACTIVE | INACTIVE
  commission_type   text,                        -- CPA / CPL / CPS etc
  commission_rate   text,                        -- human-readable rate string
  description       text,
  raw               jsonb,
  fetched_at        timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_yk_campaigns_status  ON public.yieldkit_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_yk_campaigns_country ON public.yieldkit_campaigns (country);

-- 2. Transactions / commissions (from Reporting API)
CREATE TABLE IF NOT EXISTS public.yieldkit_transactions (
  id                  bigserial PRIMARY KEY,
  yk_id               text NOT NULL UNIQUE,       -- "id" field from commissions API
  advertiser_id       text,                       -- advertiserId
  advertiser_name     text,                       -- advertiserName
  commission          numeric(12,4) DEFAULT 0,    -- commission amount
  amount              numeric(12,4) DEFAULT 0,    -- order/sale amount
  currency            text DEFAULT 'USD',
  state               text DEFAULT 'OPEN',        -- CONFIRMED | OPEN | REJECTED | DELAYED | PAID
  transaction_date    timestamptz,                -- date field from API
  modified_date       timestamptz,                -- modified_date field
  yk_tag              text,                       -- sub-ID (our go-link slug)
  go_link_slug        text,                       -- resolved publisher slug
  order_id            text,                       -- orderId from API
  commission_type     text,                       -- SALE | LEAD etc
  payout_id           integer,
  site_id             text,
  publisher_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  synced_at           timestamptz DEFAULT now(),
  raw                 jsonb
);

CREATE INDEX IF NOT EXISTS idx_yk_txn_advertiser  ON public.yieldkit_transactions (advertiser_id);
CREATE INDEX IF NOT EXISTS idx_yk_txn_publisher   ON public.yieldkit_transactions (publisher_id);
CREATE INDEX IF NOT EXISTS idx_yk_txn_slug        ON public.yieldkit_transactions (go_link_slug) WHERE go_link_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yk_txn_date        ON public.yieldkit_transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_yk_txn_tag         ON public.yieldkit_transactions (yk_tag) WHERE yk_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_yk_txn_state       ON public.yieldkit_transactions (state);

-- 3. Publisher applications
CREATE TABLE IF NOT EXISTS public.publisher_yieldkit_applications (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  publisher_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  advertiser_id   text NOT NULL,
  status          text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (publisher_id, advertiser_id)
);

CREATE INDEX IF NOT EXISTS idx_yk_apps_publisher   ON public.publisher_yieldkit_applications (publisher_id);
CREATE INDEX IF NOT EXISTS idx_yk_apps_advertiser  ON public.publisher_yieldkit_applications (advertiser_id);
CREATE INDEX IF NOT EXISTS idx_yk_apps_status      ON public.publisher_yieldkit_applications (status);

-- 4. Sync state
CREATE TABLE IF NOT EXISTS public.yieldkit_sync_state (
  id                text PRIMARY KEY DEFAULT 'default',
  last_completed_at timestamptz,
  last_error        text,
  updated_at        timestamptz DEFAULT now()
);

INSERT INTO public.yieldkit_sync_state (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- 5. Daily earnings rollup
CREATE TABLE IF NOT EXISTS public.yieldkit_publisher_earnings_daily (
  publisher_id      uuid NOT NULL,
  date              date NOT NULL,
  advertiser_id     text NOT NULL DEFAULT '',
  commission        numeric(12,4) DEFAULT 0,
  amount            numeric(12,4) DEFAULT 0,
  currency          text NOT NULL DEFAULT 'USD',
  transaction_count integer DEFAULT 0,
  PRIMARY KEY (publisher_id, date, advertiser_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_yk_daily_publisher ON public.yieldkit_publisher_earnings_daily (publisher_id);
CREATE INDEX IF NOT EXISTS idx_yk_daily_date      ON public.yieldkit_publisher_earnings_daily (date);

-- 6. Add yieldkit to go_links network check
ALTER TABLE public.publisher_go_links DROP CONSTRAINT IF EXISTS publisher_go_links_network_check;
ALTER TABLE public.publisher_go_links ADD CONSTRAINT publisher_go_links_network_check
  CHECK (network IN ('impact', 'tradetracker', 'paidonresults', 'yieldkit'));

-- 7. RLS
ALTER TABLE public.yieldkit_campaigns                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yieldkit_transactions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publisher_yieldkit_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yieldkit_sync_state                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yieldkit_publisher_earnings_daily   ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "service_all_yk_campaigns"  ON public.yieldkit_campaigns                FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_yk_txn"        ON public.yieldkit_transactions             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_yk_apps"       ON public.publisher_yieldkit_applications   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_yk_sync"       ON public.yieldkit_sync_state               FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all_yk_daily"      ON public.yieldkit_publisher_earnings_daily FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Publishers read all campaigns
CREATE POLICY "authenticated_read_yk_campaigns" ON public.yieldkit_campaigns
  FOR SELECT TO authenticated USING (true);

-- Publishers read/insert own applications
CREATE POLICY "publisher_read_own_yk_apps" ON public.publisher_yieldkit_applications
  FOR SELECT TO authenticated USING (publisher_id = auth.uid());
CREATE POLICY "publisher_insert_own_yk_apps" ON public.publisher_yieldkit_applications
  FOR INSERT TO authenticated WITH CHECK (publisher_id = auth.uid());

-- Publishers read own earnings
CREATE POLICY "publisher_read_own_yk_daily" ON public.yieldkit_publisher_earnings_daily
  FOR SELECT TO authenticated USING (publisher_id = auth.uid());

-- 8. Earnings refresh function
CREATE OR REPLACE FUNCTION public.refresh_yieldkit_publisher_earnings_daily()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  TRUNCATE TABLE public.yieldkit_publisher_earnings_daily;
  INSERT INTO public.yieldkit_publisher_earnings_daily
    (publisher_id, date, advertiser_id, commission, amount, currency, transaction_count)
  SELECT
    publisher_id,
    DATE(COALESCE(transaction_date, synced_at) AT TIME ZONE 'UTC') AS date,
    COALESCE(advertiser_id, '')                                      AS advertiser_id,
    SUM(commission)                                                  AS commission,
    SUM(COALESCE(amount, 0))                                         AS amount,
    COALESCE(currency, 'USD')                                        AS currency,
    COUNT(*)                                                         AS transaction_count
  FROM public.yieldkit_transactions
  WHERE publisher_id IS NOT NULL
    AND state IN ('CONFIRMED', 'OPEN', 'PAID')
    AND COALESCE(transaction_date, synced_at) IS NOT NULL
  GROUP BY publisher_id, date, advertiser_id, currency;
END;
$$;
