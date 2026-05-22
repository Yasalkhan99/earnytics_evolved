import type { AdmitadCampaign, AdmitadTransaction } from "./types";

const API_BASE = "https://api.admitad.com";

function getCredentials() {
  return {
    clientId:      process.env.ADMITAD_CLIENT_ID      ?? "",
    base64Header:  process.env.ADMITAD_BASE64_HEADER   ?? "",
    publisherCode: process.env.ADMITAD_PUBLISHER_CODE  ?? "",
  };
}

// ─── OAuth2 token (client_credentials) ───────────────────────────────────────
async function getToken(scope: string): Promise<string> {
  const { clientId, base64Header } = getCredentials();
  if (!clientId || !base64Header) throw new Error("Admitad credentials not configured");

  const res = await fetch(`${API_BASE}/token/`, {
    method: "POST",
    headers: {
      Authorization:  `Basic ${base64Header}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Admitad token error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`Admitad token failed: ${data.error ?? "no token"}`);
  return data.access_token;
}

// ─── Campaigns ───────────────────────────────────────────────────────────────
export async function fetchCampaigns(): Promise<AdmitadCampaign[]> {
  const token = await getToken("advcampaigns");
  const campaigns: AdmitadCampaign[] = [];
  const LIMIT = 100;
  let offset = 0;
  let total  = Infinity;

  while (offset < total) {
    const res = await fetch(
      `${API_BASE}/advcampaigns/?limit=${LIMIT}&offset=${offset}&language=en`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Admitad campaigns API ${res.status}: ${text.slice(0, 200)}`);
    }

    type RawCampaign = {
      id?: unknown; name?: unknown; site_url?: unknown; image?: unknown;
      status?: unknown; currency?: unknown; rating?: unknown; ecpc?: unknown;
      actions?: Array<{ type?: string; payment_size?: string }>;
      regions?: Array<{ region?: string }>;
      categories?: Array<{ name?: string }>;
      allow_deeplink?: unknown; connected?: unknown; description?: unknown;
    };
    type PageResp = { _meta?: { count?: number }; results?: RawCampaign[] };
    const page: PageResp = await res.json();

    total  = page._meta?.count ?? 0;
    const items = page.results ?? [];
    if (!items.length) break;

    for (const c of items) {
      const actions = Array.isArray(c.actions) ? c.actions : [];
      const firstAction = actions[0];
      const regions     = Array.isArray(c.regions)    ? c.regions.map(r => String(r.region ?? "")).filter(Boolean) : [];
      const categories  = Array.isArray(c.categories) ? c.categories.map(cat => String(cat.name ?? "")).filter(Boolean) : [];

      campaigns.push({
        campaignId:     String(c.id ?? "").trim(),
        name:           String(c.name ?? "").trim(),
        siteUrl:        typeof c.site_url === "string" ? c.site_url.trim() || null : null,
        logoUrl:        typeof c.image    === "string" ? c.image.trim()    || null : null,
        status:         typeof c.status   === "string" ? c.status.toLowerCase().trim() : "active",
        currency:       typeof c.currency === "string" ? c.currency.toUpperCase().trim() || null : null,
        rating:         typeof c.rating   === "string" ? c.rating.trim() || null : null,
        ecpc:           typeof c.ecpc     === "number" ? c.ecpc : null,
        commissionType: firstAction?.type        ?? null,
        commissionRate: firstAction?.payment_size ?? null,
        regions,
        categories,
        allowDeeplink:  c.allow_deeplink === true,
        connected:      c.connected      === true,
        description:    null,
      });
    }

    offset += items.length;
    if (items.length < LIMIT) break;
  }

  return campaigns.filter(c => c.campaignId);
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export async function fetchTransactions(opts: {
  fromDate?: string;
  toDate?:   string;
  delta?:    number;
} = {}): Promise<AdmitadTransaction[]> {
  const token = await getToken("statistics");
  const txns: AdmitadTransaction[] = [];
  const LIMIT = 500;
  let offset  = 0;
  let total   = Infinity;

  const params = new URLSearchParams({ limit: String(LIMIT) });
  if (opts.delta != null) {
    const end   = new Date();
    const start = new Date(Date.now() - opts.delta * 86400_000);
    params.set("date_start", start.toISOString().slice(0, 10));
    params.set("date_end",   end.toISOString().slice(0, 10));
  } else {
    if (opts.fromDate) params.set("date_start", opts.fromDate.slice(0, 10));
    if (opts.toDate)   params.set("date_end",   opts.toDate.slice(0, 10));
  }

  while (offset < total) {
    params.set("offset", String(offset));
    const res = await fetch(`${API_BASE}/statistics/actions/?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Admitad statistics API ${res.status}: ${text.slice(0, 200)}`);
    }

    type RawTxn = {
      id?: unknown; advcampaign_id?: unknown; advcampaign_name?: unknown;
      action?: unknown; status?: unknown; payment?: unknown; currency?: unknown;
      creation_date?: unknown; close_date?: unknown; subid?: unknown;
    };
    type PageResp = { _meta?: { count?: number }; results?: RawTxn[] };
    const page: PageResp = await res.json();

    total = page._meta?.count ?? 0;
    const items = page.results ?? [];
    if (!items.length) break;

    for (const t of items) {
      txns.push({
        admitadId:    String(t.id ?? "").trim(),
        campaignId:   t.advcampaign_id   != null ? String(t.advcampaign_id)   : null,
        campaignName: typeof t.advcampaign_name === "string" ? t.advcampaign_name.trim() || null : null,
        action:       typeof t.action   === "string" ? t.action.trim() || null : null,
        status:       typeof t.status   === "string" ? t.status.toLowerCase().trim() : "pending",
        payment:      typeof t.payment  === "number" ? t.payment : Number(t.payment ?? 0),
        currency:     typeof t.currency === "string" ? t.currency.toUpperCase().trim() || "USD" : "USD",
        creationDate: typeof t.creation_date === "string" ? t.creation_date || null : null,
        closeDate:    typeof t.close_date    === "string" ? t.close_date    || null : null,
        subid:        typeof t.subid    === "string" ? t.subid.trim() || null : null,
      });
    }

    offset += items.length;
    if (items.length < LIMIT) break;
  }

  return txns.filter(t => t.admitadId);
}

// ─── Tracking URL ─────────────────────────────────────────────────────────────
// Format: https://ad.admitad.com/g/{campaignId}/{publisherCode}/?ulp={url}&subid={slug}
export function buildTrackingUrl(campaignId: string, advertiserUrl: string, slug: string): string {
  const { publisherCode } = getCredentials();
  const base = `https://ad.admitad.com/g/${encodeURIComponent(campaignId)}/${encodeURIComponent(publisherCode)}/`;
  const params = new URLSearchParams({ ulp: advertiserUrl, subid: slug });
  return `${base}?${params}`;
}

// ─── Test connection ──────────────────────────────────────────────────────────
export async function testConnection(): Promise<{ ok: boolean; campaignCount: number; publisherCode: string }> {
  const token = await getToken("advcampaigns");
  const res = await fetch(`${API_BASE}/advcampaigns/?limit=1&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Admitad API ${res.status}`);
  const data = await res.json() as { _meta?: { count?: number } };
  const { publisherCode } = getCredentials();
  return { ok: true, campaignCount: data._meta?.count ?? 0, publisherCode };
}
