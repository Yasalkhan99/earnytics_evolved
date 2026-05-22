import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page   = Math.max(1, Number(searchParams.get("page")  ?? 1));
  const limit  = Math.min(200, Number(searchParams.get("limit") ?? 50));
  const status = searchParams.get("status") ?? "";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();
  let query = supabase
    .from("admitad_transactions")
    .select("admitad_id,campaign_id,campaign_name,action,status,payment,currency,creation_date,close_date,subid,publisher_id,go_link_slug", { count: "exact" })
    .order("creation_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count ?? 0, page, limit });
}
