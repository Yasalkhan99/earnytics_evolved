-- Run this in Supabase SQL Editor AFTER data is in yieldkit_campaigns_staging
-- Copies staging → yieldkit_campaigns (71k+ rows may take 1–2 minutes)

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

-- Verify
SELECT COUNT(*) AS total_in_main_table FROM yieldkit_campaigns;
SELECT COUNT(*) AS still_in_staging FROM yieldkit_campaigns_staging;

-- Optional: drop staging after counts match
-- DROP TABLE IF EXISTS yieldkit_campaigns_staging;
