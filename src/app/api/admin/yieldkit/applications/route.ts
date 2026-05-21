import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url    = new URL(request.url);
  const page   = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const status = url.searchParams.get("status") ?? "";
  const offset = (page - 1) * limit;

  const supabase = createServerSupabaseClient();

  let q = supabase
    .from("publisher_yieldkit_applications")
    .select("id, publisher_id, advertiser_id, status, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) q = q.eq("status", status);
  q = q.range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ applications: data ?? [], total: count ?? 0, page, limit });
}

export async function PATCH(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { id?: string; status?: string };
  const { id, status } = body;
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
  if (!["approved", "rejected", "pending"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("publisher_yieldkit_applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
