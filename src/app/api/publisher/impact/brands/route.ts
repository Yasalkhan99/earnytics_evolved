import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;
const MIN_LIMIT = 6;

type CampRow = {
  impact_id: string;
  name: string;
  advertiser_name: string | null;
  logo_url: string | null;
  click_through_url: string | null;
  status: string | null;
  currency: string | null;
  raw: Record<string, unknown> | null;
};

function toBrand(c: CampRow, appStatus?: string) {
  let uiStatus: "not_applied" | "pending" | "approved" | "rejected";
  if (!appStatus) uiStatus = "not_applied";
  else if (appStatus === "pending") uiStatus = "pending";
  else if (appStatus === "approved") uiStatus = "approved";
  else uiStatus = "rejected";

  const raw = c.raw ?? {};
  const description = typeof raw.CampaignDescription === "string" ? raw.CampaignDescription : null;
  const advertiserUrl =
    typeof raw.AdvertiserUrl === "string"
      ? raw.AdvertiserUrl
      : typeof raw.CampaignUrl === "string"
        ? raw.CampaignUrl
        : null;
  const allowsDeeplinking = raw.AllowsDeeplinking === "true";
  const contractStatus = typeof raw.ContractStatus === "string" ? raw.ContractStatus : c.status;

  return {
    campaignId: c.impact_id,
    name: c.name,
    advertiserName: c.advertiser_name,
    logoUrl: c.logo_url ? `/api/impact-logo?c=${encodeURIComponent(c.impact_id)}` : null,
    clickThroughUrl: c.click_through_url,
    advertiserUrl,
    description: description ? description.slice(0, 160) : null,
    contractStatus,
    allowsDeeplinking,
    currency: c.currency,
    applicationStatus: uiStatus,
  };
}

export async function GET(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) {
    return NextResponse.json({ error: pub.message }, { status: pub.status });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  let limit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
  limit = Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limit));
  const qRaw = (searchParams.get("q") || "").trim();
  const scope = searchParams.get("scope") === "approved" ? "approved" : "all";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  const [{ count: totalCampaigns, error: totalErr }, { data: apps, error: aErr }] = await Promise.all([
    supabase.from("impact_campaigns").select("*", { count: "exact", head: true }),
    supabase
      .from("publisher_impact_applications")
      .select("campaign_id, status")
      .eq("publisher_id", pub.userId),
  ]);

  if (totalErr) return NextResponse.json({ error: totalErr.message }, { status: 500 });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  const appByCampaign = new Map<string, string>();
  for (const a of apps ?? []) {
    appByCampaign.set(String(a.campaign_id), String(a.status));
  }

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
    .from("impact_campaigns")
    .select(
      "impact_id, name, advertiser_name, logo_url, click_through_url, status, currency, raw",
      { count: "exact" },
    )
    .order("name", { ascending: true });

  if (scope === "approved") {
    query = query.in("impact_id", approvedIds);
  }

  if (qRaw) {
    query = query.or(
      `name.ilike.%${qRaw}%,advertiser_name.ilike.%${qRaw}%,impact_id.ilike.%${qRaw}%`,
    );
  }

  const { data: campaigns, count, error: cErr } = await query.range(offset, offset + limit - 1);

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const rangeFrom = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const pageItems = (campaigns ?? []) as CampRow[];
  const rangeTo = total === 0 ? 0 : rangeFrom + pageItems.length - 1;

  return NextResponse.json({
    brands: pageItems.map((c) => toBrand(c, appByCampaign.get(c.impact_id))),
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
