import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

type CRow = {
  tt_campaign_id: string;
  locale: string;
  name: string;
  url: string | null;
  tracking_url: string | null;
  logo_url: string | null;
  assignment_status: string | null;
  commission_type: string | null;
  commission_percentage: number | null;
  commission_fixed_fee: number | null;
  currency: string | null;
  description: string | null;
  deeplinking_supported: boolean | null;
  category_id: string | null;
  category_name: string | null;
};

function toBrand(c: CRow, appStatus?: string) {
  let uiStatus: "not_applied" | "pending" | "approved" | "rejected";
  if (!appStatus) uiStatus = "not_applied";
  else if (appStatus === "pending") uiStatus = "pending";
  else if (appStatus === "approved") uiStatus = "approved";
  else uiStatus = "rejected";

  const commLabel = c.commission_percentage
    ? `${c.commission_percentage}%`
    : c.commission_fixed_fee
      ? `${c.commission_fixed_fee} ${c.currency ?? "EUR"}`
      : null;

  return {
    campaignId: c.tt_campaign_id,
    locale: c.locale,
    name: c.name,
    advertiserName: c.name,
    logoUrl: c.logo_url ?? null,
    advertiserUrl: c.url ?? null,
    description: c.description ? c.description.slice(0, 160) : null,
    currency: c.currency ?? "EUR",
    commissionLabel: commLabel,
    commissionType: c.commission_type,
    allowsDeeplinking: Boolean(c.deeplinking_supported),
    trackingUrl: c.tracking_url,
    categoryId: c.category_id ?? null,
    categoryName: c.category_name ?? null,
    applicationStatus: uiStatus,
  };
}

export async function GET(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  let limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  limit = Math.min(MAX_LIMIT, Math.max(6, limit));
  const qRaw = (searchParams.get("q") ?? "").trim();
  const scope = searchParams.get("scope") === "approved" ? "approved" : "all";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  const [{ count: totalCampaigns, error: totalErr }, { data: apps, error: aErr }] = await Promise.all([
    supabase
      .from("tradetracker_campaigns")
      .select("*", { count: "exact", head: true })
      .eq("assignment_status", "accepted"),
    supabase
      .from("publisher_tradetracker_applications")
      .select("campaign_id, status")
      .eq("publisher_id", pub.userId),
  ]);

  if (totalErr) return NextResponse.json({ error: totalErr.message }, { status: 500 });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const appByCampaign = new Map((apps ?? []).map((a) => [String(a.campaign_id), String(a.status)]));
  const approvedIds = [...appByCampaign.entries()]
    .filter(([, status]) => status === "approved")
    .map(([id]) => id);

  const catalogTotal = totalCampaigns ?? 0;

  if (scope === "approved" && approvedIds.length === 0) {
    return NextResponse.json({
      brands: [],
      pagination: { page: 1, limit, total: 0, totalPages: 1, rangeFrom: 0, rangeTo: 0 },
      totalCampaigns: catalogTotal,
    });
  }

  let query = supabase
    .from("tradetracker_campaigns")
    .select(
      "tt_campaign_id, locale, name, url, tracking_url, logo_url, assignment_status, commission_type, commission_percentage, commission_fixed_fee, currency, description, deeplinking_supported, category_id, category_name",
      { count: "exact" },
    )
    .eq("assignment_status", "accepted")
    .order("name", { ascending: true });

  if (scope === "approved") {
    query = query.in("tt_campaign_id", approvedIds);
  }

  if (qRaw) {
    query = query.or(`name.ilike.%${qRaw}%,tt_campaign_id.ilike.%${qRaw}%`);
  }

  const { data: campaigns, count, error: cErr } = await query.range(offset, offset + limit - 1);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const rangeFrom = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const pageItems = (campaigns ?? []) as CRow[];
  const rangeTo = total === 0 ? 0 : rangeFrom + pageItems.length - 1;

  return NextResponse.json({
    brands: pageItems.map((c) => toBrand(c, appByCampaign.get(c.tt_campaign_id))),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
      rangeFrom,
      rangeTo,
    },
    totalCampaigns: catalogTotal,
  });
}
