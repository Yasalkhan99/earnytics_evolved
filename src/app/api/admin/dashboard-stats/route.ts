import { NextResponse, after } from "next/server";
import { requireAdmin } from "../require-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// 30-second in-memory cache — keeps admin dashboard snappy on repeated loads
let cachedStats: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;
import {
  aggregateAwinTransactionsInRange,
  rollingUtcWindowDays,
  sumAttributedAwinByCurrency,
} from "@/lib/awin/aggregate-from-transactions";
import { maybeSyncAwinOnAdminDashboardLoad } from "@/lib/awin/dashboard-sync";
import { isAwinConfigured } from "@/lib/awin/client";
import { isImpactConfigured } from "@/lib/impact/client";
import { maybeSyncImpactOnAdminDashboardLoad } from "@/lib/impact/dashboard-sync";
import { aggregateImpactActionsInRange, sumAttributedImpactByCurrency } from "@/lib/impact/aggregate-from-actions";
import type { SupabaseClient } from "@supabase/supabase-js";

function maxCurrencyTotals(map: Record<string, number>): { currency: string | null; amount: number } {
  let best: string | null = null;
  let v = 0;
  for (const [k, val] of Object.entries(map)) {
    if (val > v) {
      v = val;
      best = k;
    }
  }
  return { currency: best, amount: v };
}

function jsonbToCurrencyMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    out[k] = Number(v ?? 0);
  }
  return out;
}

async function loadFinancialsFromRpc(
  supabase: SupabaseClient
): Promise<{ commissionByCurrency: Record<string, number>; saleByCurrency: Record<string, number> } | null> {
  const { data, error } = await supabase.rpc("admin_publisher_earnings_currency_totals");
  if (error || data == null || typeof data !== "object") return null;
  const o = data as { commissionByCurrency?: unknown; saleByCurrency?: unknown };
  return {
    commissionByCurrency: jsonbToCurrencyMap(o.commissionByCurrency),
    saleByCurrency: jsonbToCurrencyMap(o.saleByCurrency),
  };
}

async function loadWindowTotalsFromRpc(
  supabase: SupabaseClient,
  start: Date,
  end: Date
): Promise<{
  countAll: number;
  countAttributed: number;
  saleByCurrency: Record<string, number>;
  commissionByCurrency: Record<string, number>;
} | null> {
  const { data, error } = await supabase.rpc("admin_awin_transactions_window_totals", {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (error || data == null || typeof data !== "object") return null;
  const o = data as {
    countAll?: unknown;
    countAttributed?: unknown;
    saleByCurrency?: unknown;
    commissionByCurrency?: unknown;
  };
  return {
    countAll: Number(o.countAll ?? 0),
    countAttributed: Number(o.countAttributed ?? 0),
    saleByCurrency: jsonbToCurrencyMap(o.saleByCurrency),
    commissionByCurrency: jsonbToCurrencyMap(o.commissionByCurrency),
  };
}

async function loadAttributedSumsFromRpc(
  supabase: SupabaseClient
): Promise<{ commissionByCurrency: Record<string, number>; saleByCurrency: Record<string, number> } | null> {
  const { data, error } = await supabase.rpc("admin_sum_attributed_awin_by_currency");
  if (error || data == null || typeof data !== "object") return null;
  const o = data as { commissionByCurrency?: unknown; saleByCurrency?: unknown };
  return {
    commissionByCurrency: jsonbToCurrencyMap(o.commissionByCurrency),
    saleByCurrency: jsonbToCurrencyMap(o.saleByCurrency),
  };
}

export async function GET(request: Request) {
  const err = requireAdmin(request);
  if (err) return err;

  const supabase = createServerSupabaseClient();
  const url = new URL(request.url);
  const forceAwinRefresh = url.searchParams.get("refreshAwin") === "1";
  const forceImpactRefresh = url.searchParams.get("refreshImpact") === "1";
  const bustCache = url.searchParams.get("refresh") === "1" || forceAwinRefresh || forceImpactRefresh;

  // Serve from cache if still fresh and no forced refresh
  if (!bustCache && cachedStats && Date.now() < cachedStats.expiresAt) {
    return NextResponse.json(cachedStats.data);
  }

  let awinSyncOnDashboardLoad: { ran: boolean; skippedReason?: string; error?: string };
  if (isAwinConfigured()) {
    after(async () => {
      try {
        const sb = createServerSupabaseClient();
        await maybeSyncAwinOnAdminDashboardLoad(sb, { force: forceAwinRefresh });
      } catch (e) {
        console.error("[dashboard-stats] background Awin sync failed", e);
      }
    });
    awinSyncOnDashboardLoad = {
      ran: false,
      skippedReason: forceAwinRefresh
        ? "Awin refresh queued; sync runs in the background. Reload in a minute for updated transactions."
        : "Awin sync runs in the background when you open the dashboard (throttled). Reload shortly for fresh data.",
    };
  } else {
    awinSyncOnDashboardLoad = { ran: false, skippedReason: "Awin API not configured on server" };
  }

  let impactSyncOnDashboardLoad: { ran: boolean; skippedReason?: string; error?: string };
  if (isImpactConfigured()) {
    after(async () => {
      try {
        const sb = createServerSupabaseClient();
        await maybeSyncImpactOnAdminDashboardLoad(sb, { force: forceImpactRefresh });
      } catch (e) {
        console.error("[dashboard-stats] background Impact sync failed", e);
      }
    });
    impactSyncOnDashboardLoad = {
      ran: false,
      skippedReason: forceImpactRefresh
        ? "Impact refresh queued; sync runs in the background."
        : "Impact sync runs in the background when you open the dashboard (throttled).",
    };
  } else {
    impactSyncOnDashboardLoad = { ran: false, skippedReason: "Impact API not configured on server" };
  }

  const countWhere = async (table: string, filters: Record<string, string>): Promise<number> => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    for (const [col, val] of Object.entries(filters)) {
      q = q.eq(col, val);
    }
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };

  try {
    const win30 = rollingUtcWindowDays(30);

    // Fire ALL independent queries in parallel — single round-trip batch
    const [
      totalUsers,
      publishers,
      advertisers,
      profilesPending,
      profilesApproved,
      profilesRejected,
      trackingLinksCount,
      brandAppsPending,
      brandAppsApproved,
      brandAppsRejected,
      brandAppsTotal,
      programmesCached,
      impactCampaignsCached,
      impactAppsPending,
      impactAppsApproved,
      clickRpcResult,
      pendingSignupsResult,
      rpcFinancials,
      txnHeadResult,
      txnAttrResult,
      impactHeadResult,
      impactAttrResult,
      syncRowResult,
      impactSyncRowResult,
      agg30Rpc,
      linkhexaProgrammesCached,
      linkhexaProgrammesActive,
      linkhexaTransactionsCached,
      linkhexaTrackingLinks,
      linkhexaSyncRowResult,
    ] = await Promise.all([
      countWhere("profiles", {}),
      countWhere("profiles", { role: "publisher" }),
      countWhere("profiles", { role: "advertiser" }),
      countWhere("profiles", { approval_status: "pending" }),
      countWhere("profiles", { approval_status: "approved" }),
      countWhere("profiles", { approval_status: "rejected" }),
      countWhere("publisher_go_links", {}),
      countWhere("publisher_awin_applications", { status: "pending" }),
      countWhere("publisher_awin_applications", { status: "approved" }),
      countWhere("publisher_awin_applications", { status: "rejected" }),
      countWhere("publisher_awin_applications", {}),
      countWhere("awin_programmes", {}),
      countWhere("impact_campaigns", {}),
      countWhere("publisher_impact_applications", { status: "pending" }),
      countWhere("publisher_impact_applications", { status: "approved" }),
      supabase.rpc("admin_sum_go_link_clicks"),
      supabase.from("profiles").select("id, username, email, role, created_at").eq("approval_status", "pending").order("created_at", { ascending: false }).limit(10),
      loadFinancialsFromRpc(supabase),
      supabase.from("awin_transactions").select("*", { count: "exact", head: true }),
      supabase.from("awin_transactions").select("*", { count: "exact", head: true }).not("publisher_id", "is", null),
      supabase.from("impact_actions").select("*", { count: "exact", head: true }),
      supabase.from("impact_actions").select("*", { count: "exact", head: true }).not("publisher_id", "is", null),
      supabase.from("awin_transaction_sync_state").select("last_completed_at, last_error").eq("id", "default").maybeSingle(),
      supabase.from("impact_action_sync_state").select("last_completed_at, last_error").eq("id", "default").maybeSingle(),
      loadWindowTotalsFromRpc(supabase, win30.start, win30.end),
      countWhere("linkhexa_programmes", {}),
      supabase.from("linkhexa_programmes").select("*", { count: "exact", head: true }).ilike("programme_status", "active"),
      countWhere("linkhexa_transactions", {}),
      supabase.from("publisher_go_links").select("*", { count: "exact", head: true }).eq("network", "linkhexa"),
      supabase.from("linkhexa_sync_state").select("last_completed_at, last_error").eq("id", "default").maybeSingle(),
    ]);

    // Resolve clicks
    let totalClicks = 0;
    if (!clickRpcResult.error && clickRpcResult.data != null && clickRpcResult.data !== "") {
      totalClicks = Number(clickRpcResult.data);
    } else {
      const { data: clickRows, error: clickErr } = await supabase.from("publisher_go_links").select("click_count");
      if (!clickErr && clickRows) {
        totalClicks = clickRows.reduce((s, r) => s + Number((r as { click_count?: number | null }).click_count ?? 0), 0);
      }
    }

    // Resolve pending signups
    if (pendingSignupsResult.error) {
      return NextResponse.json({ error: pendingSignupsResult.error.message }, { status: 500 });
    }
    const pendingSignups = pendingSignupsResult.data;

    // ── Financials: read from Impact earnings rollup ──────────────────────────
    let commissionByCurrency: Record<string, number> = {};
    let saleByCurrency: Record<string, number> = {};
    let financialsSource: "rollup" | "awin_transactions" = "rollup";

    // Primary: Impact publisher earnings daily rollup
    const { data: impactEarnRows } = await supabase
      .from("impact_publisher_earnings_daily")
      .select("payout_currency, sale_currency, payout, sale_amount");

    if (impactEarnRows && Array.isArray(impactEarnRows) && impactEarnRows.length > 0) {
      for (const r of impactEarnRows as {
        payout_currency?: string;
        sale_currency?: string;
        payout?: number | string | null;
        sale_amount?: number | string | null;
      }[]) {
        const pc = (r.payout_currency ?? "USD").toUpperCase();
        const sc = (r.sale_currency ?? "USD").toUpperCase();
        commissionByCurrency[pc] = (commissionByCurrency[pc] ?? 0) + Number(r.payout ?? 0);
        saleByCurrency[sc] = (saleByCurrency[sc] ?? 0) + Number(r.sale_amount ?? 0);
      }
    } else if (rpcFinancials) {
      // Fallback to RPC if impact table is empty
      commissionByCurrency = rpcFinancials.commissionByCurrency;
      saleByCurrency = rpcFinancials.saleByCurrency;
    }

    // Resolve transaction counts
    const awinTxnTotal = !txnHeadResult.error ? (txnHeadResult.count ?? 0) : 0;
    const awinTxnAttributed = !txnAttrResult.error ? (txnAttrResult.count ?? 0) : 0;
    const impactActionsTotal = !impactHeadResult.error ? (impactHeadResult.count ?? 0) : 0;
    const impactActionsAttributed = !impactAttrResult.error ? (impactAttrResult.count ?? 0) : 0;

    // Resolve sync state — use Impact sync state
    const syncRow = impactSyncRowResult.data;   // was: syncRowResult.data (Awin)
    const impactSyncRow = impactSyncRowResult.data;

    // Resolve agg30 — use Impact actions aggregation
    type Agg30Shape = { countAll: number; countAttributed: number; saleByCurrency: Record<string, number>; commissionByCurrency: Record<string, number> };
    let agg30: Agg30Shape | null = null;
    try {
      const impactAgg = await aggregateImpactActionsInRange(supabase, win30.start, win30.end);
      agg30 = {
        countAll: impactAgg.countAll,
        countAttributed: impactAgg.countAttributed,
        saleByCurrency: impactAgg.saleByCurrency,
        commissionByCurrency: impactAgg.payoutByCurrency, // Impact uses payout = commission
      };
    } catch {
      agg30 = agg30Rpc ?? await aggregateAwinTransactionsInRange(supabase, win30.start, win30.end).catch(() => null);
    }

    // If rollup is empty but attributed actions exist, use live sum
    const rollupCommissionSum = Object.values(commissionByCurrency).reduce((a, b) => a + b, 0);
    if (rollupCommissionSum === 0 && impactActionsAttributed > 0) {
      const live = await sumAttributedImpactByCurrency(supabase);
      commissionByCurrency = live.payoutByCurrency;
      saleByCurrency = live.saleByCurrency;
      financialsSource = "awin_transactions";
    }

    const saleTop = maxCurrencyTotals(agg30?.saleByCurrency ?? {});
    const commTop = maxCurrencyTotals(agg30?.commissionByCurrency ?? {});

    const totalUsdCommission = commissionByCurrency.USD ?? 0;
    const totalUsdSale = saleByCurrency.USD ?? 0;
    const currencies = Object.keys(commissionByCurrency);
    const primaryCurrency =
      totalUsdCommission > 0 || totalUsdSale > 0
        ? "USD"
        : currencies.find((c) => (commissionByCurrency[c] ?? 0) > 0 || (saleByCurrency[c] ?? 0) > 0) ?? null;

    const responsePayload = {
      profiles: {
        total: totalUsers,
        publishers,
        advertisers,
        pending: profilesPending,
        approved: profilesApproved,
        rejected: profilesRejected,
      },
      publisherGoLinks: {
        count: trackingLinksCount,
        totalClicks,
      },
      brandApplications: {
        total: brandAppsTotal,
        pending: brandAppsPending,
        approved: brandAppsApproved,
        rejected: brandAppsRejected,
      },
      awinProgrammesCached: programmesCached,
      pendingSignups: pendingSignups ?? [],
      financials: {
        commissionByCurrency,
        saleByCurrency,
        totalPublisherPayoutUsd: totalUsdCommission,
        totalGrossOnLinksUsd: totalUsdSale > 0 ? totalUsdSale : null,
        primaryCurrency,
        primaryCommission: primaryCurrency != null ? (commissionByCurrency[primaryCurrency] ?? 0) : 0,
        primarySale: primaryCurrency != null ? (saleByCurrency[primaryCurrency] ?? 0) : 0,
        source: financialsSource,
      },
      awinReporting: {
        transactionsStored: impactActionsTotal,
        transactionsAttributed: impactActionsAttributed,
        lastSyncAt: syncRow?.last_completed_at ?? null,
        lastSyncError: syncRow?.last_error ?? null,
      },
      awinActivityLast30Days: {
        fromYmd: win30.start.toISOString().slice(0, 10),
        toYmd: win30.end.toISOString().slice(0, 10),
        transactionCount: agg30?.countAll ?? 0,
        transactionCountAttributed: agg30?.countAttributed ?? 0,
        saleByCurrency: agg30?.saleByCurrency ?? {},
        commissionByCurrency: agg30?.commissionByCurrency ?? {},
        primarySaleCurrency: saleTop.currency,
        primarySale: saleTop.amount,
        primaryCommissionCurrency: commTop.currency,
        primaryCommission: commTop.amount,
      },
      awinSyncOnDashboardLoad,
      impactReporting: {
        actionsStored: impactActionsTotal,
        actionsAttributed: impactActionsAttributed,
        campaignsCached: impactCampaignsCached,
        lastSyncAt: impactSyncRow?.last_completed_at ?? null,
        lastSyncError: impactSyncRow?.last_error ?? null,
        applicationsPending: impactAppsPending,
        applicationsApproved: impactAppsApproved,
      },
      impactSyncOnDashboardLoad,
      linkhexaReporting: {
        programmesCached: linkhexaProgrammesCached,
        activeProgrammes: linkhexaProgrammesActive.count ?? linkhexaProgrammesCached,
        transactionsStored: linkhexaTransactionsCached,
        trackingLinks: linkhexaTrackingLinks.count ?? 0,
        lastSyncAt: linkhexaSyncRowResult.data?.last_completed_at ?? null,
        lastSyncError: linkhexaSyncRowResult.data?.last_error ?? null,
      },
    };

    // Store in cache (skip if forced refresh so next normal load gets fresh data)
    cachedStats = { data: responsePayload, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json(responsePayload);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
