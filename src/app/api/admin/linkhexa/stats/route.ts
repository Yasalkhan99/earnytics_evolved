import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();

  const [progs, activeProgs, txns, apps, sync, linksRes, linksClickRes] = await Promise.all([
    supabase.from("linkhexa_programmes").select("*", { count: "exact", head: true }),
    supabase.from("linkhexa_programmes").select("*", { count: "exact", head: true }).ilike("programme_status", "active"),
    supabase.from("linkhexa_transactions").select("*", { count: "exact", head: true }),
    supabase.from("publisher_linkhexa_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("linkhexa_sync_state").select("last_completed_at,last_error").eq("id", "default").maybeSingle(),
    supabase.from("publisher_go_links").select("*", { count: "exact", head: true }).eq("network", "linkhexa"),
    supabase.from("publisher_go_links").select("click_count").eq("network", "linkhexa"),
  ]);

  if (progs.error) {
    return NextResponse.json({ error: progs.error.message }, { status: 500 });
  }

  const totalProgrammes  = progs.count ?? 0;
  const activeProgrammes = activeProgs.count ?? 0;
  const totalTxns        = txns.count ?? 0;
  const pendingApps      = apps.count ?? 0;

  const commissionByCurrency: Record<string, number> = {};
  if (totalTxns > 0) {
    const { data: txnRows } = await supabase
      .from("linkhexa_transactions")
      .select("commission_amount,currency,status")
      .limit(5000);
    for (const t of txnRows ?? []) {
      if (t.status === "rejected") continue;
      const c = t.currency ?? "USD";
      commissionByCurrency[c] = (commissionByCurrency[c] ?? 0) + Number(t.commission_amount ?? 0);
    }
  }

  const linkCount = linksRes.count ?? 0;
  const totalClicks = (linksClickRes.data ?? []).reduce(
    (s, r) => s + Number((r as { click_count?: number | null }).click_count ?? 0), 0
  );

  return NextResponse.json({
    totalProgrammes, activeProgrammes, totalTransactions: totalTxns,
    pendingApplications: pendingApps, commissionByCurrency,
    trackingLinks: linkCount,
    totalClicks,
    lastSyncAt:    sync.data?.last_completed_at ?? null,
    lastSyncError: sync.data?.last_error        ?? null,
  });
}
