-- ============================================================
-- STEP 1: Run this first — creates the staging table
-- ============================================================
CREATE TABLE IF NOT EXISTS yieldkit_campaigns_staging (
  id                  INTEGER,
  campaign_id         TEXT,
  campaign_name       TEXT,
  campaign_url        TEXT,
  campaign_description TEXT,
  advertiser_id       TEXT,
  advertiser_name     TEXT,
  advertiser_url      TEXT,
  contract_status     TEXT,
  tracking_link       TEXT,
  allows_deeplinking  TEXT,
  deeplink_domains    TEXT,
  shipping_regions    TEXT,
  raw                 TEXT,
  fetched_at          TIMESTAMPTZ
);

-- ============================================================
-- STEP 2: Import the CSV into "yieldkit_campaigns_staging"
--         via Supabase Table Editor → Import CSV
--         (columns now match exactly)
-- ============================================================

-- ============================================================
-- STEP 3: Run this AFTER CSV import — copies to main table
-- ============================================================
INSERT INTO yieldkit_campaigns (
  advertiser_id,
  name,
  url,
  logo_url,
  country,
  status,
  commission_type,
  commission_rate,
  description,
  raw,
  fetched_at
)
SELECT
  advertiser_id,
  name,
  url,
  logo_url,
  country,
  status,
  commission_type,
  commission_rate,
  description,
  raw,
  fetched_at
FROM (
  SELECT DISTINCT ON (campaign_id)
    campaign_id                                         AS advertiser_id,
    COALESCE(
      NULLIF(TRIM(campaign_name), ''),
      NULLIF(TRIM(advertiser_name), ''),
      NULLIF(
        regexp_replace(
          regexp_replace(COALESCE(campaign_url, advertiser_url, ''), '^https?://(www\.)?', '', 'i'),
          '/.*$', ''
        ),
        ''
      ),
      campaign_id
    )                                                   AS name,
    COALESCE(NULLIF(TRIM(campaign_url), ''), NULLIF(TRIM(advertiser_url), '')) AS url,
    NULL::TEXT                                          AS logo_url,
    SPLIT_PART(shipping_regions, ',', 1)               AS country,
    COALESCE(NULLIF(UPPER(TRIM(contract_status)), ''), 'ACTIVE') AS status,
    NULL::TEXT                                          AS commission_type,
    NULL::TEXT                                          AS commission_rate,
    campaign_description                                AS description,
    CASE
      WHEN raw IS NOT NULL AND raw <> ''
      THEN raw::JSONB
      ELSE NULL
    END                                                 AS raw,
    COALESCE(fetched_at, NOW())                        AS fetched_at
  FROM yieldkit_campaigns_staging
  WHERE campaign_id IS NOT NULL AND TRIM(campaign_id) <> ''
  ORDER BY campaign_id, fetched_at DESC NULLS LAST, id DESC NULLS LAST
) deduped
ON CONFLICT (advertiser_id) DO UPDATE SET
  name            = EXCLUDED.name,
  url             = EXCLUDED.url,
  status          = EXCLUDED.status,
  description     = EXCLUDED.description,
  raw             = EXCLUDED.raw,
  fetched_at      = EXCLUDED.fetched_at;

-- ============================================================
-- STEP 4: Verify count
-- ============================================================
SELECT COUNT(*) AS imported FROM yieldkit_campaigns;

-- ============================================================
-- STEP 5: Clean up staging table
-- ============================================================
DROP TABLE IF EXISTS yieldkit_campaigns_staging;
