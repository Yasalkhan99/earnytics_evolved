import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("publisher_linkhexa_applications")
    .select("id,publisher_id,programme_id,status,applied_at,reviewed_at,notes")
    .eq("status", status)
    .order("applied_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { id: number; status: string; notes?: string };
  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from("publisher_linkhexa_applications")
    .update({ status: body.status, reviewed_at: new Date().toISOString(), notes: body.notes ?? null })
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
