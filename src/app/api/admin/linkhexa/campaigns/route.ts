import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const search = (searchParams.get("q") ?? "").trim();
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();
  let q = supabase
    .from("linkhexa_programmes")
    .select("programme_id,name,display_url,logo_url,programme_status,currency_code,primary_region,fetched_at", { count: "exact" })
    .order("name");

  if (search) q = q.ilike("name", `%${search}%`);
  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0, totalPages: Math.max(1, Math.ceil((count ?? 0) / limit)) },
  });
}
