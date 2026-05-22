import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";

export async function POST(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  let body: { campaignId?: unknown; campaignIds?: unknown[] } = {};
  try { body = await request.json(); } catch { /* default */ }

  const supabase = createServerSupabaseClient();

  // Bulk apply
  if (Array.isArray(body.campaignIds) && body.campaignIds.length > 0) {
    const ids = body.campaignIds.map((id) => String(id ?? "").trim()).filter(Boolean);
    if (!ids.length) return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });

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
