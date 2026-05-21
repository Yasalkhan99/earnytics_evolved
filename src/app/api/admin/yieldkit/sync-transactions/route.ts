import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchTransactions } from "@/lib/yieldkit/client";

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(request.url);
  const from   = url.searchParams.get("from") ?? undefined;
  const to     = url.searchParams.get("to")   ?? undefined;
  const deltaS = url.searchParams.get("delta");
  const delta  = deltaS ? parseInt(deltaS) || undefined : undefined;

  const supabase = createServerSupabaseClient();

  let txns;
  try {
    txns = await fetchTransactions({ fromDate: from, toDate: to, delta });
  } catch (e) {
    const msg = String(e);
    await supabase.from("yieldkit_sync_state").upsert({
      id: "default", last_error: msg, updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  if (!txns.length)
    return NextResponse.json({ ok: true, upserted: 0, total: 0 });

  // Attribute go-link slugs to publishers via yk_tag
  const slugSet = new Set(txns.map((t) => t.ykTag).filter(Boolean) as string[]);
  const publisherBySlug = new Map<string, string>();
  if (slugSet.size > 0) {
    const { data: links } = await supabase
      .from("publisher_go_links")
      .select("slug, publisher_id")
      .in("slug", [...slugSet]);
    for (const l of links ?? []) {
      if (l.slug && l.publisher_id) publisherBySlug.set(l.slug, l.publisher_id);
    }
  }

  const rows = txns.map((t) => {
    const slug        = t.ykTag ?? null;
    const publisherId = slug ? (publisherBySlug.get(slug) ?? null) : null;
    return {
      yk_id:            t.ykId,
      advertiser_id:    t.advertiserId,
      advertiser_name:  t.advertiserName,
      commission:       t.commission,
      amount:           t.amount,
      currency:         t.currency,
      state:            t.state,
      transaction_date: t.date,
      modified_date:    t.modifiedDate,
      yk_tag:           slug,
      go_link_slug:     slug,
      order_id:         t.orderId,
      commission_type:  t.commissionType,
      payout_id:        t.payoutId,
      site_id:          t.siteId,
      publisher_id:     publisherId,
      synced_at:        new Date().toISOString(),
      raw:              t,
    };
  });

  const CHUNK = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("yieldkit_transactions")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "yk_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    upserted += Math.min(CHUNK, rows.length - i);
  }

  await supabase.from("yieldkit_sync_state").upsert({
    id: "default",
    last_completed_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return NextResponse.json({ ok: true, upserted, total: txns.length });
}
