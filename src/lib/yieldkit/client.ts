import type { YieldkitCampaign, YieldkitTransaction } from "./types";

const ADVERTISER_API = "https://api.yieldkit.com";
const REPORTING_API  = "https://account2.yieldkit.com/api/v3/reports";
// Redirect base – Yieldkit serves tracking redirects via their redirect domain
const REDIRECT_BASE  = process.env.YIELDKIT_REDIRECT_DOMAIN
  ? `https://${process.env.YIELDKIT_REDIRECT_DOMAIN}`
  : "https://r.yieldkit.com";

function getCredentials() {
  return {
    apiKey:     process.env.YIELDKIT_API_KEY      ?? "",
    apiSecret:  process.env.YIELDKIT_API_SECRET   ?? "",
    siteId:     process.env.YIELDKIT_SITE_ID      ?? "",
    domain:     process.env.YIELDKIT_DOMAIN       ?? "",
  };
}

// ─── Campaigns ───────────────────────────────────────────────────────────────
export async function fetchCampaigns(): Promise<YieldkitCampaign[]> {
  const { apiKey, apiSecret, siteId, domain } = getCredentials();
  if (!apiKey || !apiSecret || !siteId) throw new Error("Yieldkit credentials not configured");

  // domainGeoPairs is REQUIRED (omitting it → 400). geos must be non-empty strings (null/[] → 400).
  // The domain must be pre-approved by Yieldkit AM — until approved the API returns
  // "Unavailable in YK (Apply via AM)" and zero campaign rows (not an error).
  const effectiveDomain = domain || "earnytics.com";
  const geos = (process.env.YIELDKIT_GEOS ?? "US,GB,DE,FR,NL,IT,ES,PL,AT,CH,AU,CA,BE,SE,NO,DK,FI")
    .split(",").map((g) => g.trim()).filter(Boolean);

  const body = {
    siteId,
    apiKey,
    apiSecret,
    domainGeoPairs: [{ domain: effectiveDomain, geos }],
  };

  const res = await fetch(`${ADVERTISER_API}/v1/advertiser-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const rawText = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`Yieldkit advertiser API HTTP ${res.status}: ${rawText.slice(0, 200)}`);
  }

  return parseAdvertiserResponse(rawText);
}

// Parse the advertiser-status response — handles both JSON and CSV formats.
// The Yieldkit API may return CSV (Content-Type: text/plain or text/csv) even
// when Accept: application/json is sent.
function parseAdvertiserResponse(raw: string): YieldkitCampaign[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // ── JSON path ─────────────────────────────────────────────────────────────
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    type ApiAdvertiser = {
      advertiserId?: unknown; advertiserName?: unknown; advertiserUrl?: unknown;
      advertiserFavicon?: unknown; country?: unknown; status?: unknown;
      commissionType?: unknown; commissionRate?: unknown; description?: unknown;
    };
    const json: { content?: ApiAdvertiser[] } | ApiAdvertiser[] = JSON.parse(trimmed);
    const items: ApiAdvertiser[] = Array.isArray(json)
      ? (json as ApiAdvertiser[])
      : ((json as { content?: ApiAdvertiser[] }).content ?? []);

    return items
      .map((a): YieldkitCampaign => ({
        advertiserId:   String(a.advertiserId ?? "").trim(),
        name:           String(a.advertiserName ?? a.advertiserId ?? "").trim(),
        url:            typeof a.advertiserUrl === "string" ? a.advertiserUrl.trim() || null : null,
        logoUrl:        typeof a.advertiserFavicon === "string" ? a.advertiserFavicon.trim() || null : null,
        country:        typeof a.country === "string" ? a.country.trim() || null : null,
        status:         typeof a.status === "string" ? a.status.toUpperCase().trim() : "ACTIVE",
        commissionType: typeof a.commissionType === "string" ? a.commissionType.trim() || null : null,
        commissionRate: typeof a.commissionRate === "string" ? a.commissionRate.trim() || null : null,
        description:    typeof a.description === "string" ? a.description.trim() || null : null,
      }))
      .filter((c) => c.advertiserId);
  }

  // ── CSV path ───────────────────────────────────────────────────────────────
  // Expected header (case-insensitive, order may vary):
  //   Domain, AvailabilityType, AdvertiserId, AdvertiserName, AdvertiserUrl,
  //   Favicon, Country, Status, CommissionType, CommissionRate, Description
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => headers.indexOf(name.toLowerCase());

  const iId    = idx("advertiserid");
  const iName  = idx("advertisername");
  const iUrl   = idx("advertiserurl");
  const iFav   = idx("favicon");
  const iCou   = idx("country");
  const iStat  = idx("status");
  const iCType = idx("commissiontype");
  const iCRate = idx("commissionrate");
  const iDesc  = idx("description");

  const campaigns: YieldkitCampaign[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const advertiserId = iId >= 0 ? cols[iId]?.trim() ?? "" : "";
    if (!advertiserId) continue;

    campaigns.push({
      advertiserId,
      name:           (iName  >= 0 ? cols[iName]?.trim()  : "") || advertiserId,
      url:            (iUrl   >= 0 ? cols[iUrl]?.trim()   : "") || null,
      logoUrl:        (iFav   >= 0 ? cols[iFav]?.trim()   : "") || null,
      country:        (iCou   >= 0 ? cols[iCou]?.trim()   : "") || null,
      status:         (iStat  >= 0 ? cols[iStat]?.trim().toUpperCase() : "") || "ACTIVE",
      commissionType: (iCType >= 0 ? cols[iCType]?.trim() : "") || null,
      commissionRate: (iCRate >= 0 ? cols[iCRate]?.trim() : "") || null,
      description:    (iDesc  >= 0 ? cols[iDesc]?.trim()  : "") || null,
    });
  }

  return campaigns;
}

// Minimal RFC-4180 CSV line splitter (handles quoted fields with commas).
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

// ─── Transactions / Commissions ───────────────────────────────────────────────
export async function fetchTransactions(opts: {
  fromDate?: string; // ISO datetime e.g. 2024-01-01T00:00:00.000Z
  toDate?: string;
  delta?: number;    // days back from now (alternative to from/to)
} = {}): Promise<YieldkitTransaction[]> {
  const { apiKey, apiSecret, siteId } = getCredentials();
  if (!apiKey || !apiSecret || !siteId) throw new Error("Yieldkit credentials not configured");

  const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const params = new URLSearchParams({ site_id: siteId });

  if (opts.delta != null) {
    params.set("delta", String(opts.delta));
  } else {
    if (opts.fromDate) params.set("start_date", opts.fromDate);
    if (opts.toDate)   params.set("end_date",   opts.toDate);
  }

  const allTxns: YieldkitTransaction[] = [];
  let nextUrl: string | null = `${REPORTING_API}/commissions/sales?${params}`;

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Yieldkit reporting API HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    type CommissionItem = {
      id?: unknown;
      advertiserName?: unknown;
      advertiserId?: unknown;
      commission?: unknown;
      amount?: unknown;
      currency?: unknown;
      state?: unknown;
      date?: unknown;
      modified_date?: unknown;
      ykTag?: unknown;
      orderId?: unknown;
      commissionType?: unknown;
      payoutId?: unknown;
      siteId?: unknown;
    };
    type CommissionResponse = { content?: CommissionItem[]; next?: string };

    const data: CommissionResponse = await res.json();
    const items = data.content ?? [];

    for (const item of items) {
      allTxns.push({
        ykId:           String(item.id ?? "").trim(),
        advertiserName: typeof item.advertiserName === "string" ? item.advertiserName.trim() || null : null,
        advertiserId:   typeof item.advertiserId   === "string" ? item.advertiserId.trim()   || null : null,
        commission:     Number(item.commission ?? 0),
        amount:         Number(item.amount ?? 0),
        currency:       typeof item.currency === "string" ? item.currency.toUpperCase().trim() || "USD" : "USD",
        state:          typeof item.state === "string" ? item.state.toUpperCase().trim() : "OPEN",
        date:           typeof item.date === "string" ? item.date || null : null,
        modifiedDate:   typeof item.modified_date === "string" ? item.modified_date || null : null,
        ykTag:          typeof item.ykTag === "string" ? item.ykTag.trim() || null : null,
        orderId:        typeof item.orderId === "string" ? item.orderId.trim() || null : null,
        commissionType: typeof item.commissionType === "string" ? item.commissionType.trim() || null : null,
        payoutId:       typeof item.payoutId === "number" ? item.payoutId : null,
        siteId:         typeof item.siteId === "string" ? item.siteId.trim() || null : null,
      });
    }

    // Pagination via next URL
    nextUrl = typeof data.next === "string" && data.next.trim() ? data.next.trim() : null;
  }

  return allTxns.filter((t) => t.ykId);
}

// ─── Build tracking URL for a go-link ─────────────────────────────────────────
// Uses Redirect API: /v1/redirect?api_key=...&type=url&url=...&site_id=...&yk_tag=...
export function buildTrackingUrl(advertiserUrl: string, slug: string): string {
  const { apiKey, siteId } = getCredentials();
  const params = new URLSearchParams({
    api_key: apiKey,
    type:    "url",
    url:     advertiserUrl,
    site_id: siteId,
    yk_tag:  slug,
  });
  return `${REDIRECT_BASE}/v1/redirect?${params}`;
}
