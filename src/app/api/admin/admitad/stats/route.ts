import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();

  const [camps, txns, apps, sync] = await Promise.all([
    supabase.from("admitad_campaigns").select("status", { count: "exact", head: false }),
    supabase.from("admitad_transactions").select("payment,currency,status"),
    supabase.from("publisher_admitad_applications").select("status", { count: "exact", head: false }).eq("status", "pending"),
    supabase.from("admitad_sync_state").select("last_completed_at,last_error").eq("id", "default").single(),
  ]);

  const totalCampaigns  = camps.count ?? 0;
  const activeCampaigns = (camps.data ?? []).filter(c => c.status === "active").length;
  const totalTxns       = txns.data?.length ?? 0;
  const pendingApps     = apps.count ?? 0;

  const commissionByCurrency: Record<string, number> = {};
  for (const t of txns.data ?? []) {
    if (t.status !== "rejected") {
      const c = t.currency ?? "USD";
      commissionByCurrency[c] = (commissionByCurrency[c] ?? 0) + (t.payment ?? 0);
    }
  }

  return NextResponse.json({
    totalCampaigns, activeCampaigns, totalTransactions: totalTxns,
    pendingApplications: pendingApps, commissionByCurrency,
    lastSyncAt:    sync.data?.last_completed_at ?? null,
    lastSyncError: sync.data?.last_error        ?? null,
  });
}
