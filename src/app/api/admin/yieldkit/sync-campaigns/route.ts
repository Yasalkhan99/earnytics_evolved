import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchCampaigns } from "@/lib/yieldkit/client";

// Debug: GET /api/admin/yieldkit/sync-campaigns → returns raw API response
export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey    = process.env.YIELDKIT_API_KEY    ?? "";
  const apiSecret = process.env.YIELDKIT_API_SECRET ?? "";
  const siteId    = process.env.YIELDKIT_SITE_ID    ?? "";
  const domain    = process.env.YIELDKIT_DOMAIN     ?? "";

  const body = domain
    ? { siteId, apiKey, apiSecret, domainGeoPairs: [{ domain, geos: null }] }
    : { siteId, apiKey, apiSecret };

  const res = await fetch("https://api.yieldkit.com/v1/advertiser-status", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  return NextResponse.json({
    status: res.status,
    contentType: res.headers.get("content-type"),
    bodyPreview: text.slice(0, 2000),
    bodyLength: text.length,
  });
}

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();

  let campaigns;
  try {
    campaigns = await fetchCampaigns();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  if (!campaigns.length)
    return NextResponse.json({
      ok: true, upserted: 0, total: 0,
      warning: "Yieldkit returned 0 campaigns. Your domain is likely not yet approved by the Yieldkit Account Manager. Visit /admin/yieldkit/connection for setup instructions.",
    });

  const rows = campaigns.map((c) => ({
    advertiser_id:   c.advertiserId,
    name:            c.name,
    url:             c.url,
    logo_url:        c.logoUrl,
    country:         c.country,
    status:          c.status,
    commission_type: c.commissionType,
    commission_rate: c.commissionRate,
    description:     c.description,
    raw:             c,
    fetched_at:      new Date().toISOString(),
  }));

  const CHUNK = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("yieldkit_campaigns")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "advertiser_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    upserted += Math.min(CHUNK, rows.length - i);
  }

  await supabase.from("yieldkit_sync_state").upsert({
    id: "default",
    last_completed_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return NextResponse.json({ ok: true, upserted, total: campaigns.length });
}
