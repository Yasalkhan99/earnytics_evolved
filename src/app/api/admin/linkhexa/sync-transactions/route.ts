import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchTransactions } from "@/lib/linkhexa/client";

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => ({})) as { delta?: number; fromDate?: string; toDate?: string };
  const delta = body.delta ?? 90;

  let transactions;
  try {
    transactions = await fetchTransactions({
      deltaDays: body.fromDate || body.toDate ? undefined : delta,
      fromDate:  body.fromDate,
      toDate:    body.toDate,
    });
  } catch (e) {
    await supabase.from("linkhexa_sync_state").upsert({
      id: "default", last_error: String(e), updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  if (!transactions.length)
    return NextResponse.json({ ok: true, upserted: 0, total: 0 });

  const slugs = [...new Set(transactions.map(t => t.clickRef).filter(Boolean))] as string[];
  const slugMap = new Map<string, string>();
  if (slugs.length) {
    const { data: links } = await supabase
      .from("publisher_go_links")
      .select("slug, publisher_id")
      .in("slug", slugs)
      .eq("network", "linkhexa");
    for (const l of links ?? []) slugMap.set(l.slug, l.publisher_id);
  }

  const rows = transactions.map((t) => ({
    linkhexa_txn_id:    t.linkhexaTxnId,
    programme_id:       t.programmeId,
    programme_name:     t.programmeName,
    sale_amount:        t.saleAmount,
    commission_amount:  t.commissionAmount,
    currency:           t.currency,
    transaction_date:   t.transactionDate,
    status:             t.status,
    click_ref:          t.clickRef,
    publisher_id:       t.clickRef ? (slugMap.get(t.clickRef) ?? null) : null,
    go_link_slug:       t.clickRef ?? null,
    raw:                t,
    synced_at:          new Date().toISOString(),
  }));

  const CHUNK = 200;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("linkhexa_transactions")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "linkhexa_txn_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    upserted += Math.min(CHUNK, rows.length - i);
  }

  await supabase.from("linkhexa_sync_state").upsert({
    id: "default", last_completed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return NextResponse.json({ ok: true, upserted, total: transactions.length });
}
