import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireBrandsAccess } from "@/lib/publisher-session";
import { commissionFromProgrammeRow } from "@/lib/linkhexa/commission";

export async function GET(request: Request) {
  const pub = await requireBrandsAccess();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "24"), 500);
  const search = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").trim();
  const scope  = url.searchParams.get("scope") ?? "all";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  const { data: apps } = pub.userId
    ? await supabase
        .from("publisher_linkhexa_applications")
        .select("programme_id, status")
        .eq("publisher_id", pub.userId)
    : { data: [] as { programme_id: string; status: string }[] };

  const appMap      = new Map((apps ?? []).map((a) => [a.programme_id, a.status as string]));
  const approvedIds = [...appMap.entries()].filter(([, s]) => s === "approved").map(([id]) => id);

  let q = supabase
    .from("linkhexa_programmes")
    .select("programme_id, name, display_url, logo_url, programme_status, currency_code, primary_region, country_code, click_through_url, description", { count: "exact" })
    .order("name");

  if (scope === "approved") {
    if (!approvedIds.length) return NextResponse.json({ brands: [], pagination: null, totalCampaigns: 0 });
    q = q.in("programme_id", approvedIds);
  } else {
    q = q.ilike("programme_status", "Active");
  }

  if (search) q = q.ilike("name", `%${search}%`);
  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total  = count ?? 0;
  const brands = (data ?? []).map((c) => {
    const cleanName = (c.name ?? "").trim() || `Programme ${c.programme_id}`;
    const comm = commissionFromProgrammeRow(c);
    return {
      campaignId:        c.programme_id,
      name:              cleanName,
      advertiserName:    cleanName,
      advertiserUrl:     c.display_url ?? null,
      displayUrl:        c.display_url ?? null,
      logoUrl:           c.logo_url ?? null,
      description:       null,
      contractStatus:    c.programme_status ?? "Active",
      currency:          c.currency_code ?? "USD",
      allowsDeeplinking: true,
      applicationStatus: (appMap.get(c.programme_id) ?? "not_applied") as "not_applied" | "pending" | "approved" | "rejected",
      commissionLabel:   comm.commissionSummary,
      commissionType:    comm.commissionType,
      locale:            c.country_code ?? c.primary_region ?? "US",
      categoryName:      c.primary_region ?? null,
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
