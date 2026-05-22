import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page   = Math.max(1, Number(searchParams.get("page")  ?? 1));
  const limit  = Math.min(100, Number(searchParams.get("limit") ?? 50));
  const search = searchParams.get("search") ?? "";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("admitad_campaigns")
    .select("campaign_id,name,site_url,logo_url,status,currency,commission_type,commission_rate,regions,categories,allow_deeplink,connected,fetched_at", { count: "exact" })
    .order("name")
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}
