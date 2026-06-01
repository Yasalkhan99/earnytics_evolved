import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { isAdmitadTestCampaign } from "@/lib/admitad/client";

export async function GET(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "24"), 500);
  const search = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").trim();
  const scope  = url.searchParams.get("scope") ?? "all";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  const { data: apps } = await supabase
    .from("publisher_admitad_applications")
    .select("campaign_id, status")
    .eq("publisher_id", pub.userId);

  const appMap      = new Map((apps ?? []).map((a) => [a.campaign_id, a.status as string]));
  const approvedIds = [...appMap.entries()].filter(([, s]) => s === "approved").map(([id]) => id);

  let q = supabase
    .from("admitad_campaigns")
    .select("campaign_id, name, site_url, logo_url, status, currency, commission_type, commission_rate, regions, categories, allow_deeplink", { count: "exact" })
    .order("name");

  if (scope === "approved") {
    if (!approvedIds.length) return NextResponse.json({ brands: [], pagination: null, totalCampaigns: 0 });
    q = q.in("campaign_id", approvedIds);
  } else {
    // Only show campaigns where our Admitad publisher account is connected
    q = q.eq("status", "active").eq("connected", true);
  }

  // Hide Admitad internal test/onboarding programs (e.g. campaign 105626)
  q = q
    .neq("campaign_id", "105626")
    .or("site_url.is.null,site_url.not.ilike.%onboarding.admitad.com%");

  if (search) q = q.ilike("name", `%${search}%`);
  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const publisherCampaigns = (data ?? []).filter((c) => !isAdmitadTestCampaign(c));
  const total  = count ?? 0;
  const brands = publisherCampaigns.map((c) => {
    // Derive a display name: prefer stored name, else extract from site_url, else campaign_id
    const rawName = (c.name ?? "").trim();
    let cleanName: string;
    if (rawName) {
      cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    } else if (c.site_url) {
      // Extract domain without www/https, capitalize first letter
      const domain = (c.site_url as string)
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/.*$/, "");
      cleanName = domain.charAt(0).toUpperCase() + domain.slice(1);
    } else {
      cleanName = `Campaign ${c.campaign_id}`;
    }

    return {
      campaignId:        c.campaign_id,
      name:              cleanName,
      advertiserName:    cleanName,
      advertiserUrl:     c.site_url ?? null,
      displayUrl:        c.site_url ?? null,
      logoUrl:           c.logo_url ?? null,
      description:       null,
      // BrandsGridContent checks === "Active" (capital A)
      contractStatus:    c.status
        ? c.status.charAt(0).toUpperCase() + c.status.slice(1)
        : null,
      currency:          c.currency ?? "USD",
      allowsDeeplinking: c.allow_deeplink ?? false,
      applicationStatus: (appMap.get(c.campaign_id) ?? "not_applied") as "not_applied" | "pending" | "approved" | "rejected",
      commissionLabel:   c.commission_rate ?? c.commission_type ?? null,
      commissionType:    c.commission_type ?? null,
      locale:            (c.regions as string[] | null)?.[0] ?? "US",
      categoryName:      (c.categories as string[] | null)?.[0] ?? null,
    };
  });

  return NextResponse.json({
    brands,
    pagination: {
      page, limit, total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rangeFrom: offset + 1,
      rangeTo:   Math.min(offset + limit, total),
    },
    totalCampaigns: total,
  });
}
