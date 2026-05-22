-- Commission display fields (cached from Awin programmedetails or description parse)
ALTER TABLE linkhexa_programmes
  ADD COLUMN IF NOT EXISTS commission_summary text,
  ADD COLUMN IF NOT EXISTS commission_type text,
  ADD COLUMN IF NOT EXISTS epc text,
  ADD COLUMN IF NOT EXISTS conversion_rate text,
  ADD COLUMN IF NOT EXISTS validation_days integer,
  ADD COLUMN IF NOT EXISTS deeplink_enabled boolean,
  ADD COLUMN IF NOT EXISTS commission_fetched_at timestamptz;
