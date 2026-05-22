import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";

export async function GET(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "12"), 500);
  const search = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").trim();
  const scope  = url.searchParams.get("scope") ?? "all";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  const { data: apps } = await supabase
    .from("publisher_yieldkit_applications")
    .select("advertiser_id, status")
    .eq("publisher_id", pub.userId);

  const appMap     = new Map((apps ?? []).map((a) => [a.advertiser_id, a.status as string]));
  const approvedIds = [...appMap.entries()].filter(([, s]) => s === "approved").map(([id]) => id);

  let q = supabase
    .from("yieldkit_campaigns")
    .select("advertiser_id, name, url, logo_url, country, status, commission_type, commission_rate, description", { count: "exact" })
    .order("name");

  if (scope === "approved") {
    if (!approvedIds.length) return NextResponse.json({ brands: [], pagination: null, totalCampaigns: 0 });
    q = q.in("advertiser_id", approvedIds);
  } else {
    q = q.in("status", ["ACTIVE", "active", "Active"]);
  }

  if (search) q = q.ilike("name", `%${search}%`);
  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total  = count ?? 0;
  const brands = (data ?? []).map((c) => ({
    campaignId:        c.advertiser_id,
    name:              c.name,
    advertiserName:    c.name,
    advertiserUrl:     c.url,
    displayUrl:        c.url,
    logoUrl:           c.logo_url ?? null,
    description:       c.description ?? null,
    contractStatus:    c.status,
    currency:          "USD",
    allowsDeeplinking: true,
    applicationStatus: (appMap.get(c.advertiser_id) ?? "not_applied") as "not_applied" | "pending" | "approved" | "rejected",
    commissionLabel:   c.commission_rate ?? c.commission_type ?? null,
    commissionType:    c.commission_type ?? null,
    locale:            c.country ?? "US",
    categoryName:      null,
  }));

  return NextResponse.json({
    brands,
    pagination: {
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rangeFrom: offset + 1,
      rangeTo: Math.min(offset + limit, total),
    },
    totalCampaigns: total,
  });
}
