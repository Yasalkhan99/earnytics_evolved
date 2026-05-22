import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";

export async function POST(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  let body: { campaignId?: unknown; programmeId?: unknown; campaignIds?: unknown[] } = {};
  try { body = await request.json(); } catch { /* default */ }

  const supabase = createServerSupabaseClient();

  if (Array.isArray(body.campaignIds) && body.campaignIds.length > 0) {
    const ids = body.campaignIds.map((id) => String(id ?? "").trim()).filter(Boolean);
    if (!ids.length) return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });

    const rows = ids.map((id) => ({
      publisher_id: pub.userId,
      programme_id: id,
      status:       "pending",
      applied_at:   new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("publisher_linkhexa_applications")
      .upsert(rows, { onConflict: "publisher_id,programme_id", ignoreDuplicates: true })
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  }

  const programmeId = String(body.campaignId ?? body.programmeId ?? "").trim();
  if (!programmeId) return NextResponse.json({ error: "programmeId required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("publisher_linkhexa_applications")
    .select("id, status")
    .eq("publisher_id", pub.userId)
    .eq("programme_id", programmeId)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, status: existing.status, alreadyApplied: true });

  const { data, error } = await supabase
    .from("publisher_linkhexa_applications")
    .insert({ publisher_id: pub.userId, programme_id: programmeId, status: "pending", applied_at: new Date().toISOString() })
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, applicationId: data.id, status: data.status });
}
