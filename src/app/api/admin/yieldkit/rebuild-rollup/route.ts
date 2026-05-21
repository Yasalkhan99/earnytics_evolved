import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc("refresh_yieldkit_publisher_earnings_daily");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
