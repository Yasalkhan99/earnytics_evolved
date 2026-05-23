import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";

function parseDateBoundary(s: string | null, endOfDay: boolean): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s.trim());
  if (Number.isNaN(d.getTime())) return null;
  endOfDay ? d.setUTCHours(23, 59, 59, 999) : d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addMoney(bucket: Record<string, number>, currency: string | null | undefined, amount: number) {
  const c = (currency ?? "USD").toUpperCase().trim() || "USD";
  bucket[c] = (bucket[c] ?? 0) + (Number.isFinite(amount) ? amount : 0);
}

function mergeMoneyInto(target: Record<string, number>, source: Record<string, number>) {
  for (const [c, v] of Object.entries(source)) addMoney(target, c, v);
}

function mergeAdvertiserRows(rows: AdvertiserRow[]): AdvertiserRow[] {
  const map = new Map<string, AdvertiserRow>();
  for (const r of rows) {
    const key = `${r.network}:${r.advertiserId}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...r,
        revenueByCurrency: { ...r.revenueByCurrency },
        commissionByCurrency: { ...r.commissionByCurrency },
      });
      continue;
    }
    existing.clicks = Math.max(existing.clicks, r.clicks);
    existing.sales += r.sales;
    existing.leads += r.leads;
    mergeMoneyInto(existing.revenueByCurrency, r.revenueByCurrency);
    mergeMoneyInto(existing.commissionByCurrency, r.commissionByCurrency);
    if (!existing.logoUrl && r.logoUrl) existing.logoUrl = r.logoUrl;
    if (existing.name.startsWith("Campaign ") && !r.name.startsWith("Campaign ")) existing.name = r.name;
  }
  return [...map.values()];
}

type AdvertiserRow = {
  advertiserId: string;
  name: string;
  logoUrl: string | null;
  network: "Impact" | "TradeTracker" | "PaidOnResults" | "Yieldkit" | "Admitad" | "Linkhexa";
  clicks: number;
  sales: number;
  leads: number;
  revenueByCurrency: Record<string, number>;
  commissionByCurrency: Record<string, number>;
};

export async function GET(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const url = new URL(request.url);
  const toD = parseDateBoundary(url.searchParams.get("to"), true) ?? (() => {
    const d = new Date(); d.setUTCHours(23, 59, 59, 999); return d;
  })();
  let fromD = parseDateBoundary(url.searchParams.get("from"), false);
  if (!fromD) {
    const d = new Date(toD);
    d.setUTCDate(d.getUTCDate() - 364);
    d.setUTCHours(0, 0, 0, 0);
    fromD = d;
  }
  if (fromD.getTime() > toD.getTime())
    return NextResponse.json({ error: "from must be on or before to" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const fromIso = fromD.toISOString();
  const toIso   = toD.toISOString();

  // ── 1. Publisher's go-links (click counts by campaign + network) ────────────
  const { data: goLinks } = await supabase
    .from("publisher_go_links")
    .select("slug, click_count, campaign_id, network")
    .eq("publisher_id", pub.userId);

  const clicksByCampaign = new Map<string, number>();
  for (const l of goLinks ?? []) {
    const key = `${l.network}:${l.campaign_id}`;
    clicksByCampaign.set(key, (clicksByCampaign.get(key) ?? 0) + Number(l.click_count ?? 0));
  }
  const totalClicks = [...clicksByCampaign.values()].reduce((s, v) => s + v, 0);

  // ── 2. Impact actions ───────────────────────────────────────────────────────
  const { data: impactActions } = await supabase
    .from("impact_actions")
    .select("campaign_id, action_status, payout, payout_currency, sale_amount, sale_currency, action_date")
    .eq("publisher_id", pub.userId)
    .gte("action_date", fromIso)
    .lte("action_date", toIso)
    .limit(5000);

  // aggregate by campaign
  const impactByCampaign = new Map<string, { sales: number; rev: Record<string, number>; comm: Record<string, number> }>();
  for (const a of impactActions ?? []) {
    const cid = String(a.campaign_id ?? "");
    if (!cid) continue;
    const cur = impactByCampaign.get(cid) ?? { sales: 0, rev: {}, comm: {} };
    cur.sales += 1;
    addMoney(cur.rev,  a.sale_currency,   Number(a.sale_amount ?? 0));
    addMoney(cur.comm, a.payout_currency, Number(a.payout ?? 0));
    impactByCampaign.set(cid, cur);
  }

  // ── 3. TradeTracker transactions ────────────────────────────────────────────
  const { data: ttTxns } = await supabase
    .from("tradetracker_transactions")
    .select("tt_campaign_id, transaction_status, commission, order_amount, currency, registration_date")
    .eq("publisher_id", pub.userId)
    .gte("registration_date", fromIso)
    .lte("registration_date", toIso)
    .limit(5000);

  // ── 3b. PaidOnResults transactions ──────────────────────────────────────────
  const { data: porTxns } = await supabase
    .from("por_transactions")
    .select("merchant_id, transaction_status, affiliate_commission, order_value, currency, order_date")
    .eq("publisher_id", pub.userId)
    .gte("order_date", fromIso)
    .lte("order_date", toIso)
    .limit(5000);

  // ── 3c. Yieldkit transactions ────────────────────────────────────────────────
  const { data: ykTxns } = await supabase
    .from("yieldkit_transactions")
    .select("advertiser_id, state, commission, amount, currency, transaction_date")
    .eq("publisher_id", pub.userId)
    .gte("transaction_date", fromIso)
    .lte("transaction_date", toIso)
    .limit(5000);

  // ── 3d. Admitad transactions ─────────────────────────────────────────────────
  const { data: admitadTxns } = await supabase
    .from("admitad_transactions")
    .select("campaign_id, status, payment, currency, creation_date")
    .eq("publisher_id", pub.userId)
    .gte("creation_date", fromIso)
    .lte("creation_date", toIso)
    .limit(5000);

  const porByCampaign = new Map<string, { sales: number; rev: Record<string, number>; comm: Record<string, number> }>();
  for (const t of porTxns ?? []) {
    const cid = String(t.merchant_id ?? "");
    if (!cid) continue;
    const cur = porByCampaign.get(cid) ?? { sales: 0, rev: {}, comm: {} };
    cur.sales += 1;
    addMoney(cur.rev,  t.currency ?? "GBP", Number(t.order_value ?? 0));
    addMoney(cur.comm, t.currency ?? "GBP", Number(t.affiliate_commission ?? 0));
    porByCampaign.set(cid, cur);
  }

  const ykByCampaign = new Map<string, { sales: number; rev: Record<string, number>; comm: Record<string, number> }>();
  for (const t of ykTxns ?? []) {
    const cid = String(t.advertiser_id ?? "");
    if (!cid) continue;
    const cur = ykByCampaign.get(cid) ?? { sales: 0, rev: {}, comm: {} };
    cur.sales += 1;
    addMoney(cur.rev,  t.currency ?? "USD", Number(t.amount ?? 0));
    addMoney(cur.comm, t.currency ?? "USD", Number(t.commission ?? 0));
    ykByCampaign.set(cid, cur);
  }

  const admitadByCampaign = new Map<string, { sales: number; rev: Record<string, number>; comm: Record<string, number> }>();
  for (const t of admitadTxns ?? []) {
    const cid = String(t.campaign_id ?? "");
    if (!cid) continue;
    const cur = admitadByCampaign.get(cid) ?? { sales: 0, rev: {}, comm: {} };
    cur.sales += 1;
    addMoney(cur.comm, t.currency ?? "USD", Number(t.payment ?? 0));
    admitadByCampaign.set(cid, cur);
  }

  const { data: lhTxns } = await supabase
    .from("linkhexa_transactions")
    .select("programme_id, status, commission_amount, sale_amount, currency, transaction_date")
    .eq("publisher_id", pub.userId)
    .gte("transaction_date", fromIso)
    .lte("transaction_date", toIso)
    .limit(5000);

  const lhByCampaign = new Map<string, { sales: number; rev: Record<string, number>; comm: Record<string, number> }>();
  for (const t of lhTxns ?? []) {
    const cid = String(t.programme_id ?? "");
    if (!cid) continue;
    const cur = lhByCampaign.get(cid) ?? { sales: 0, rev: {}, comm: {} };
    cur.sales += 1;
    addMoney(cur.rev,  t.currency ?? "USD", Number(t.sale_amount ?? 0));
    addMoney(cur.comm, t.currency ?? "USD", Number(t.commission_amount ?? 0));
    lhByCampaign.set(cid, cur);
  }

  const ttByCampaign = new Map<string, { sales: number; rev: Record<string, number>; comm: Record<string, number> }>();
  for (const t of ttTxns ?? []) {
    const cid = String(t.tt_campaign_id ?? "");
    if (!cid) continue;
    const cur = ttByCampaign.get(cid) ?? { sales: 0, rev: {}, comm: {} };
    cur.sales += 1;
    addMoney(cur.rev,  t.currency, Number(t.order_amount ?? 0));
    addMoney(cur.comm, t.currency, Number(t.commission ?? 0));
    ttByCampaign.set(cid, cur);
  }

  // ── 4. Campaign name + logo lookups ─────────────────────────────────────────
  const impactIds = [...new Set([...impactByCampaign.keys(), ...(goLinks ?? []).filter(l => l.network === "impact").map(l => l.campaign_id)])];
  const ttIds     = [...new Set([...ttByCampaign.keys(),    ...(goLinks ?? []).filter(l => l.network === "tradetracker").map(l => l.campaign_id)])];
  const porIds      = [...new Set([...porByCampaign.keys(),     ...(goLinks ?? []).filter(l => l.network === "paidonresults").map(l => l.campaign_id)])];
  const ykIds       = [...new Set([...ykByCampaign.keys(),      ...(goLinks ?? []).filter(l => l.network === "yieldkit").map(l => l.campaign_id)])];
  const admitadIds  = [...new Set([...admitadByCampaign.keys(), ...(goLinks ?? []).filter(l => l.network === "admitad").map(l => l.campaign_id)])];
  const lhIds       = [...new Set([...lhByCampaign.keys(), ...(goLinks ?? []).filter(l => l.network === "linkhexa").map(l => l.campaign_id)])];

  const [{ data: impactCampaigns }, { data: ttCampaigns }, { data: porMerchants }, { data: ykCampaigns }, { data: admitadCampaigns }, { data: lhProgrammes }] = await Promise.all([
    impactIds.length   > 0 ? supabase.from("impact_campaigns").select("impact_id, name, logo_url").in("impact_id", impactIds) : { data: [] },
    ttIds.length       > 0 ? supabase.from("tradetracker_campaigns").select("tt_campaign_id, name, logo_url").in("tt_campaign_id", ttIds) : { data: [] },
    porIds.length      > 0 ? supabase.from("por_merchants").select("merchant_id, name, logo_url").in("merchant_id", porIds) : { data: [] },
    ykIds.length       > 0 ? supabase.from("yieldkit_campaigns").select("advertiser_id, name, logo_url").in("advertiser_id", ykIds) : { data: [] },
    admitadIds.length  > 0 ? supabase.from("admitad_campaigns").select("campaign_id, name, logo_url").in("campaign_id", admitadIds) : { data: [] },
    lhIds.length       > 0 ? supabase.from("linkhexa_programmes").select("programme_id, name, logo_url").in("programme_id", lhIds) : { data: [] },
  ]);

  const impactNameMap   = new Map((impactCampaigns   ?? []).map(c => [String(c.impact_id),       { name: c.name, logo: c.logo_url }]));
  const ttNameMap       = new Map((ttCampaigns       ?? []).map(c => [String(c.tt_campaign_id),  { name: c.name, logo: c.logo_url }]));
  const porNameMap      = new Map((porMerchants      ?? []).map(c => [String(c.merchant_id),     { name: c.name, logo: c.logo_url }]));
  const ykNameMap       = new Map((ykCampaigns       ?? []).map(c => [String(c.advertiser_id),   { name: c.name, logo: c.logo_url }]));
  const admitadNameMap  = new Map((admitadCampaigns  ?? []).map(c => [String(c.campaign_id),     { name: c.name, logo: c.logo_url }]));
  const lhNameMap       = new Map((lhProgrammes      ?? []).map(c => [String(c.programme_id),    { name: c.name, logo: c.logo_url }]));

  // ── 5. Build advertiser rows ─────────────────────────────────────────────────
  const rows: AdvertiserRow[] = [];

  const kpiRev: Record<string, number>  = {};
  const kpiComm: Record<string, number> = {};
  let kpiSales = 0;

  // Impact rows
  for (const [cid, agg] of impactByCampaign) {
    kpiSales += agg.sales;
    Object.entries(agg.rev).forEach(([c, v])  => addMoney(kpiRev,  c, v));
    Object.entries(agg.comm).forEach(([c, v]) => addMoney(kpiComm, c, v));
    const meta = impactNameMap.get(cid);
    const key  = `impact:${cid}`;
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Impact",
      clicks:  clicksByCampaign.get(key) ?? 0,
      sales:   agg.sales,
      leads:   0,
      revenueByCurrency:    agg.rev,
      commissionByCurrency: agg.comm,
    });
  }
  // Impact click-only rows (no transactions but has go-links)
  for (const l of (goLinks ?? []).filter(l => l.network === "impact")) {
    const cid = String(l.campaign_id ?? "");
    if (!cid || impactByCampaign.has(cid)) continue;
    const meta = impactNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Impact",
      clicks:  clicksByCampaign.get(`impact:${cid}`) ?? 0,
      sales:   0, leads: 0,
      revenueByCurrency: {}, commissionByCurrency: {},
    });
  }

  // TradeTracker rows
  for (const [cid, agg] of ttByCampaign) {
    kpiSales += agg.sales;
    Object.entries(agg.rev).forEach(([c, v])  => addMoney(kpiRev,  c, v));
    Object.entries(agg.comm).forEach(([c, v]) => addMoney(kpiComm, c, v));
    const meta = ttNameMap.get(cid);
    const key  = `tradetracker:${cid}`;
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `TT Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "TradeTracker",
      clicks:  clicksByCampaign.get(key) ?? 0,
      sales:   agg.sales,
      leads:   0,
      revenueByCurrency:    agg.rev,
      commissionByCurrency: agg.comm,
    });
  }
  // TT click-only rows
  for (const l of (goLinks ?? []).filter(l => l.network === "tradetracker")) {
    const cid = String(l.campaign_id ?? "");
    if (!cid || ttByCampaign.has(cid)) continue;
    const meta = ttNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `TT Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "TradeTracker",
      clicks:  clicksByCampaign.get(`tradetracker:${cid}`) ?? 0,
      sales:   0, leads: 0,
      revenueByCurrency: {}, commissionByCurrency: {},
    });
  }

  // PaidOnResults rows
  for (const [cid, agg] of porByCampaign) {
    kpiSales += agg.sales;
    Object.entries(agg.rev).forEach(([c, v])  => addMoney(kpiRev,  c, v));
    Object.entries(agg.comm).forEach(([c, v]) => addMoney(kpiComm, c, v));
    const meta = porNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `POR Merchant ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "PaidOnResults",
      clicks:  clicksByCampaign.get(`paidonresults:${cid}`) ?? 0,
      sales:   agg.sales, leads: 0,
      revenueByCurrency: agg.rev, commissionByCurrency: agg.comm,
    });
  }
  for (const l of (goLinks ?? []).filter(l => l.network === "paidonresults")) {
    const cid = String(l.campaign_id ?? "");
    if (!cid || porByCampaign.has(cid)) continue;
    const meta = porNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `POR Merchant ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "PaidOnResults",
      clicks:  clicksByCampaign.get(`paidonresults:${cid}`) ?? 0,
      sales:   0, leads: 0,
      revenueByCurrency: {}, commissionByCurrency: {},
    });
  }

  // Yieldkit rows
  for (const [cid, agg] of ykByCampaign) {
    kpiSales += agg.sales;
    Object.entries(agg.rev).forEach(([c, v])  => addMoney(kpiRev,  c, v));
    Object.entries(agg.comm).forEach(([c, v]) => addMoney(kpiComm, c, v));
    const meta = ykNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `YK Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Yieldkit",
      clicks:  clicksByCampaign.get(`yieldkit:${cid}`) ?? 0,
      sales:   agg.sales, leads: 0,
      revenueByCurrency: agg.rev, commissionByCurrency: agg.comm,
    });
  }
  for (const l of (goLinks ?? []).filter(l => l.network === "yieldkit")) {
    const cid = String(l.campaign_id ?? "");
    if (!cid || ykByCampaign.has(cid)) continue;
    const meta = ykNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `YK Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Yieldkit",
      clicks:  clicksByCampaign.get(`yieldkit:${cid}`) ?? 0,
      sales:   0, leads: 0,
      revenueByCurrency: {}, commissionByCurrency: {},
    });
  }

  // Admitad rows
  for (const [cid, agg] of admitadByCampaign) {
    kpiSales += agg.sales;
    Object.entries(agg.comm).forEach(([c, v]) => addMoney(kpiComm, c, v));
    const meta = admitadNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `Admitad Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Admitad",
      clicks:  clicksByCampaign.get(`admitad:${cid}`) ?? 0,
      sales:   agg.sales, leads: 0,
      revenueByCurrency: agg.rev, commissionByCurrency: agg.comm,
    });
  }
  for (const l of (goLinks ?? []).filter(l => l.network === "admitad")) {
    const cid = String(l.campaign_id ?? "");
    if (!cid || admitadByCampaign.has(cid)) continue;
    const meta = admitadNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `Admitad Campaign ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Admitad",
      clicks:  clicksByCampaign.get(`admitad:${cid}`) ?? 0,
      sales:   0, leads: 0,
      revenueByCurrency: {}, commissionByCurrency: {},
    });
  }

  for (const [cid, agg] of lhByCampaign) {
    kpiSales += agg.sales;
    Object.entries(agg.rev).forEach(([c, v])  => addMoney(kpiRev,  c, v));
    Object.entries(agg.comm).forEach(([c, v]) => addMoney(kpiComm, c, v));
    const meta = lhNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `Linkhexa Programme ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Linkhexa",
      clicks:  clicksByCampaign.get(`linkhexa:${cid}`) ?? 0,
      sales:   agg.sales, leads: 0,
      revenueByCurrency: agg.rev, commissionByCurrency: agg.comm,
    });
  }
  for (const l of (goLinks ?? []).filter(l => l.network === "linkhexa")) {
    const cid = String(l.campaign_id ?? "");
    if (!cid || lhByCampaign.has(cid)) continue;
    const meta = lhNameMap.get(cid);
    rows.push({
      advertiserId: cid,
      name:    meta?.name ?? `Linkhexa Programme ${cid}`,
      logoUrl: meta?.logo ?? null,
      network: "Linkhexa",
      clicks:  clicksByCampaign.get(`linkhexa:${cid}`) ?? 0,
      sales:   0, leads: 0,
      revenueByCurrency: {}, commissionByCurrency: {},
    });
  }

  const mergedRows = mergeAdvertiserRows(rows);

  // Sort by commission desc, then clicks
  mergedRows.sort((a, b) => {
    const sumComm = (r: AdvertiserRow) => Object.values(r.commissionByCurrency).reduce((s, v) => s + v, 0);
    return sumComm(b) - sumComm(a) || b.clicks - a.clicks;
  });

  return NextResponse.json({
    from: fromD.toISOString().slice(0, 10),
    to:   toD.toISOString().slice(0, 10),
    attributedTransactionCount: kpiSales,
    kpis: {
      totalClicks,
      sales:  kpiSales,
      leads:  0,
      revenueByCurrency:    kpiRev,
      commissionByCurrency: kpiComm,
    },
    advertisers: mergedRows,
  });
}
