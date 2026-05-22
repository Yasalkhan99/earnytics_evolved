import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchCampaigns } from "@/lib/admitad/client";

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
    return NextResponse.json({ ok: true, upserted: 0, total: 0 });

  const rows = campaigns.map((c) => ({
    campaign_id:     c.campaignId,
    name:            c.name,
    site_url:        c.siteUrl,
    logo_url:        c.logoUrl,
    status:          c.status,
    currency:        c.currency,
    rating:          c.rating,
    ecpc:            c.ecpc,
    commission_type: c.commissionType,
    commission_rate: c.commissionRate,
    regions:         c.regions,
    categories:      c.categories,
    allow_deeplink:  c.allowDeeplink,
    connected:       c.connected,
    raw:             c,
    fetched_at:      new Date().toISOString(),
  }));

  const CHUNK = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("admitad_campaigns")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "campaign_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    upserted += Math.min(CHUNK, rows.length - i);
  }

  await supabase.from("admitad_sync_state").upsert({
    id: "default", last_completed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return NextResponse.json({ ok: true, upserted, total: campaigns.length });
}
