import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchTransactions } from "@/lib/admitad/client";

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => ({})) as { delta?: number; fromDate?: string; toDate?: string };
  const delta = body.delta ?? 90;

  let transactions;
  try {
    transactions = await fetchTransactions({ delta });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  if (!transactions.length)
    return NextResponse.json({ ok: true, upserted: 0, total: 0 });

  // Resolve publisher_id from subid (go-link slug)
  const slugs = [...new Set(transactions.map(t => t.subid).filter(Boolean))] as string[];
  const slugMap = new Map<string, string>();
  if (slugs.length) {
    const { data: links } = await supabase
      .from("publisher_go_links")
      .select("slug, publisher_id")
      .in("slug", slugs)
      .eq("network", "admitad");
    for (const l of links ?? []) slugMap.set(l.slug, l.publisher_id);
  }

  const rows = transactions.map((t) => ({
    admitad_id:    t.admitadId,
    campaign_id:   t.campaignId,
    campaign_name: t.campaignName,
    action:        t.action,
    status:        t.status,
    payment:       t.payment,
    currency:      t.currency,
    creation_date: t.creationDate,
    close_date:    t.closeDate,
    subid:         t.subid,
    publisher_id:  t.subid ? (slugMap.get(t.subid) ?? null) : null,
    go_link_slug:  t.subid ?? null,
    raw:           t,
    synced_at:     new Date().toISOString(),
  }));

  const CHUNK = 200;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("admitad_transactions")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "admitad_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    upserted += Math.min(CHUNK, rows.length - i);
  }

  await supabase.from("admitad_sync_state").upsert({
    id: "default", last_completed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return NextResponse.json({ ok: true, upserted, total: transactions.length });
}
