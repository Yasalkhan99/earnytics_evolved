import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const search = url.searchParams.get("q") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  let q = supabase
    .from("yieldkit_campaigns")
    .select("advertiser_id, name, url, logo_url, country, status, commission_type, commission_rate, fetched_at", { count: "exact" })
    .order("name");

  if (search) q = q.ilike("name", `%${search}%`);
  if (status) q = q.eq("status", status.toUpperCase());
  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    campaigns: data ?? [],
    total: count ?? 0,
    page, limit,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)),
  });
}
