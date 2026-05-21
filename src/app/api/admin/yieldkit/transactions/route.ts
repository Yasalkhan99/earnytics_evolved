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
  const state  = url.searchParams.get("state") ?? "";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  let q = supabase
    .from("yieldkit_transactions")
    .select(
      "yk_id, advertiser_id, advertiser_name, commission, amount, currency, state, transaction_date, yk_tag, go_link_slug, order_id, commission_type, publisher_id, synced_at",
      { count: "exact" }
    )
    .order("transaction_date", { ascending: false });

  if (search) q = q.or(`advertiser_name.ilike.%${search}%,yk_tag.ilike.%${search}%`);
  if (state)  q = q.eq("state", state.toUpperCase());
  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    transactions: data ?? [],
    total: count ?? 0,
    page, limit,
  });
}
