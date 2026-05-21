import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();

  const [
    { count: totalCampaigns },
    { count: activeCampaigns },
    { count: totalTxns },
    { count: pendingApps },
    { data: commData },
    { data: syncState },
  ] = await Promise.all([
    supabase.from("yieldkit_campaigns").select("*", { count: "exact", head: true }),
    supabase.from("yieldkit_campaigns").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("yieldkit_transactions").select("*", { count: "exact", head: true }),
    supabase.from("publisher_yieldkit_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("yieldkit_transactions").select("commission, currency").in("state", ["CONFIRMED", "PAID"]),
    supabase.from("yieldkit_sync_state").select("last_completed_at, last_error").eq("id", "default").maybeSingle(),
  ]);

  const commByCurrency: Record<string, number> = {};
  for (const r of commData ?? []) {
    const c = (r.currency ?? "USD").toUpperCase();
    commByCurrency[c] = (commByCurrency[c] ?? 0) + Number(r.commission ?? 0);
  }

  return NextResponse.json({
    totalCampaigns:      totalCampaigns  ?? 0,
    activeCampaigns:     activeCampaigns ?? 0,
    totalTransactions:   totalTxns       ?? 0,
    pendingApplications: pendingApps     ?? 0,
    commissionByCurrency: commByCurrency,
    lastSyncAt:    (syncState as { last_completed_at?: string } | null)?.last_completed_at ?? null,
    lastSyncError: (syncState as { last_error?: string }        | null)?.last_error        ?? null,
  });
}
