import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { isAdmitadTestCampaign } from "@/lib/admitad/client";

export async function POST(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  let body: { campaignId?: unknown; campaignIds?: unknown[] } = {};
  try { body = await request.json(); } catch { /* default */ }

  const supabase = createServerSupabaseClient();

  async function rejectTestCampaign(campaignId: string): Promise<NextResponse | null> {
    const { data: row } = await supabase
      .from("admitad_campaigns")
      .select("campaign_id, name, site_url")
      .eq("campaign_id", campaignId)
      .maybeSingle();
    if (!row || isAdmitadTestCampaign(row)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return null;
  }

  // Bulk apply
  if (Array.isArray(body.campaignIds) && body.campaignIds.length > 0) {
    const ids = body.campaignIds.map((id) => String(id ?? "").trim()).filter(Boolean);
    if (!ids.length) return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });

    for (const id of ids) {
      const blocked = await rejectTestCampaign(id);
      if (blocked) return blocked;
    }

    const rows = ids.map((id) => ({
      publisher_id: pub.userId,
      campaign_id:  id,
      status:       "pending",
      applied_at:   new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("publisher_admitad_applications")
      .upsert(rows, { onConflict: "publisher_id,campaign_id", ignoreDuplicates: true })
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  }

  // Single apply
  const campaignId = String(body.campaignId ?? "").trim();
  if (!campaignId) return NextResponse.json({ error: "campaignId is required" }, { status: 400 });

  const blocked = await rejectTestCampaign(campaignId);
  if (blocked) return blocked;

  const { data: existing } = await supabase
    .from("publisher_admitad_applications")
    .select("id, status")
    .eq("publisher_id", pub.userId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, status: existing.status, alreadyApplied: true });

  const { data, error } = await supabase
    .from("publisher_admitad_applications")
    .insert({ publisher_id: pub.userId, campaign_id: campaignId, status: "pending", applied_at: new Date().toISOString() })
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, applicationId: data.id, status: data.status });
}
