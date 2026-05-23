"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Campaign = {
  campaign_id: string; name: string; site_url: string | null;
  logo_url: string | null; status: string; currency: string | null;
  description: string | null; primary_region: string | null;
  click_through_url: string | null;
  commission_summary: string | null;
  commission_type: string | null;
  epc: string | null;
  conversion_rate: string | null;
  validation_days: number | null;
  deeplink_enabled: boolean | null;
};

type CommissionInfo = {
  commissionSummary: string | null;
  commissionType: string | null;
  epc: string | null;
  conversionRate: string | null;
  validationDays: number | null;
  deeplinkEnabled: boolean | null;
  source: "linkhexa" | "description" | null;
};

type KpiInfo = {
  awinIndex: number | null;
  approvalPercentageDisplay: string | null;
  averagePaymentTime: string | null;
};

type Creative = {
  promotionId: number;
  type: string;
  title: string;
  description: string | null;
  voucherCode: string | null;
  urlTracking: string | null;
  endDate: string | null;
};

type GoLink = { id: string; slug: string; target_url: string; deep_link: boolean; created_at: string };
type Tab = "overview" | "commission" | "creatives" | "tracking";

const accent = "linear-gradient(135deg,#0d9488,#14b8a6)";

export default function LinkhexaBrandDetailContent({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [commission, setCommission] = useState<CommissionInfo | null>(null);
  const [kpi, setKpi] = useState<KpiInfo | null>(null);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [goLinks, setGoLinks] = useState<GoLink[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const applyPayload = useCallback((data: Record<string, unknown>) => {
    setCampaign((data.campaign as Campaign) ?? null);
    setCommission((data.commission as CommissionInfo) ?? null);
    setCreatives((data.creatives as Creative[]) ?? []);
    const k = data.kpi as KpiInfo | null | undefined;
    setKpi(k ? {
      awinIndex: k.awinIndex ?? null,
      approvalPercentageDisplay: k.approvalPercentageDisplay ?? null,
      averagePaymentTime: k.averagePaymentTime ?? null,
    } : null);
    setApplicationStatus((data.applicationStatus as string) ?? null);
    setGoLinks((data.goLinks as GoLink[]) ?? []);
  }, []);

  const load = useCallback(async (opts?: { showSpinner?: boolean; refresh?: boolean } | boolean) => {
    const options = typeof opts === "boolean" ? { showSpinner: opts } : opts;
    const showSpinner = options?.showSpinner !== false;
    if (showSpinner) setLoading(true);

    try {
      if (options?.refresh) {
        setRefreshing(true);
        const res = await fetch(
          `/api/publisher/linkhexa/brands/${campaignId}?enrich=1&refresh=1`,
          { credentials: "include" },
        );
        if (res.status === 401) { router.replace("/login"); return; }
        if (res.ok) applyPayload(await res.json());
        return;
      }

      // Phase 1: DB only — page opens quickly
      const fastRes = await fetch(
        `/api/publisher/linkhexa/brands/${campaignId}?fast=1`,
        { credentials: "include" },
      );
      if (fastRes.status === 401) { router.replace("/login"); return; }
      if (!fastRes.ok) return;

      const fastData = await fastRes.json();
      applyPayload(fastData);
      setLoading(false);

      // Phase 2: Linkhexa EPC / creatives (slow external API)
      if (!fastData.enrichPending) return;

      setEnriching(true);
      const enrichRes = await fetch(
        `/api/publisher/linkhexa/brands/${campaignId}?enrich=1`,
        { credentials: "include" },
      );
      if (enrichRes.ok) applyPayload(await enrichRes.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
      setEnriching(false);
    }
  }, [campaignId, router, applyPayload]);

  useEffect(() => { load(); }, [load]);

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 2000); } catch { /* ignore */ }
  };

  const applyNow = async () => {
    if (!campaign) return;
    setApplying(true);
    try {
      const res = await fetch("/api/publisher/linkhexa/apply", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.campaign_id }),
      });
      if (res.ok) setApplicationStatus("pending");
    } finally { setApplying(false); }
  };

  const createLink = async () => {
    if (!campaign) return;
    setCreating(true); setCreateError(null); setLastCreated(null);
    try {
      const res = await fetch("/api/publisher/linkhexa/go-links", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programmeId: Number(campaign.campaign_id) }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? "Failed to create link."); return; }
      const shortUrl = (data.shortUrl ?? data.targetUrl) as string | undefined;
      setLastCreated(shortUrl ?? null);
      if (shortUrl) {
        const row: GoLink = {
          id: (data.slug as string) ?? shortUrl,
          slug: (data.slug as string) ?? "",
          target_url: shortUrl,
          deep_link: false,
          created_at: new Date().toISOString(),
        };
        setGoLinks((prev) => {
          if (prev.some((l) => l.slug === row.slug || l.target_url === row.target_url)) return prev;
          return [row, ...prev];
        });
      }
    } catch { setCreateError("Request failed."); }
    finally { setCreating(false); }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500" />
    </div>
  );

  if (!campaign) return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <p className="text-gray-500">Programme not found.</p>
      <Link href="/dashboard/brands" className="text-teal-600 hover:underline">← Back to brands</Link>
    </div>
  );

  const displayName = campaign.name?.trim() || campaign.campaign_id;
  const country = campaign.primary_region ?? "Global";
  const comm = commission ?? {
    commissionSummary: campaign.commission_summary,
    commissionType: campaign.commission_type,
    epc: campaign.epc,
    conversionRate: campaign.conversion_rate,
    validationDays: campaign.validation_days,
    deeplinkEnabled: campaign.deeplink_enabled,
    source: null,
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "commission", label: "Commission" },
    { id: "creatives", label: `Creatives${creatives.length ? ` (${creatives.length})` : ""}` },
    { id: "tracking", label: "Tracking links" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6" style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>
      <Link href="/dashboard/brands" className="mb-5 inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        All brands
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="w-full lg:w-56 lg:shrink-0 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="h-1" style={{ background: accent }} />
            <div className="flex flex-col items-center p-5 text-center">
              {campaign.logo_url ? (
                <img src={campaign.logo_url} alt={displayName}
                  className="h-16 w-16 rounded-2xl border border-gray-100 object-contain p-1"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black text-white" style={{ background: accent }}>
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <h1 className="mt-3 text-base font-extrabold text-gray-900">{displayName}</h1>
              <p className="mt-0.5 text-[11px] text-gray-400">Linkhexa · {country}</p>
              {enriching && (
                <p className="mt-1 text-[10px] text-teal-600">Loading EPC &amp; creatives…</p>
              )}

              {campaign.site_url && (
                <a href={campaign.site_url} target="_blank" rel="noreferrer"
                  className="mt-2 flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-teal-600 hover:border-teal-300 hover:bg-teal-50">
                  Visit store
                </a>
              )}

              <div className="mt-3 w-full">
                {applicationStatus === "approved" ? (
                  <span className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700">✓ Approved</span>
                ) : applicationStatus === "pending" ? (
                  <span className="flex w-full items-center justify-center rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-bold text-amber-700">⏳ Pending</span>
                ) : applicationStatus === "rejected" ? (
                  <span className="flex w-full items-center justify-center rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-bold text-red-600">✗ Rejected</span>
                ) : (
                  <button onClick={applyNow} disabled={applying}
                    className="w-full rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-60" style={{ background: accent }}>
                    {applying ? "Applying…" : "Apply to join"}
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-gray-50 divide-y divide-gray-50">
              {[
                ["Commission", comm.commissionSummary ?? "—"],
                ["EPC", comm.epc ?? "—"],
                ["Currency", campaign.currency ?? "—"],
                ["Status", campaign.status],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2 px-4 py-2">
                  <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
                  <span className="text-[11px] font-medium text-gray-700 text-right truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-100">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`pb-2.5 px-1 mr-4 text-sm font-semibold ${tab === t.id ? "border-b-2 border-teal-500 text-teal-700" : "text-gray-400"}`}>
                {t.label}
              </button>
            ))}
            {tab === "commission" && (
              <button
                type="button"
                disabled={refreshing}
                onClick={() => { setRefreshing(true); void load({ showSpinner: false, refresh: true }); }}
                className="ml-auto mb-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Refresh from Linkhexa"}
              </button>
            )}
          </div>

          {tab === "overview" && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
              {[
                ["Programme ID", campaign.campaign_id],
                ["Network", "Linkhexa (Awin catalogue)"],
                ["Region", country],
                ["Currency", campaign.currency ?? "—"],
                ["Status", campaign.status],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4 px-5 py-3">
                  <span className="min-w-[140px] text-sm text-gray-500">{label}</span>
                  <span className="text-sm text-gray-800">{value}</span>
                </div>
              ))}
              {campaign.description && (
                <div className="px-5 py-3 text-sm text-gray-600">{campaign.description}</div>
              )}
            </div>
          )}

          {tab === "commission" && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-50 px-5 py-4">
                  <h2 className="font-extrabold text-gray-900">Commission details</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    ["Commission rate", comm.commissionSummary ?? "—"],
                    ["Commission type", comm.commissionType ?? "—"],
                    ["EPC", comm.epc ?? "—"],
                    ["Conversion rate", comm.conversionRate ?? "—"],
                    ["Awin index", kpi?.awinIndex != null ? String(kpi.awinIndex) : "—"],
                    ["Approval rate", kpi?.approvalPercentageDisplay ?? "—"],
                    ["Avg. payment time", kpi?.averagePaymentTime ? `${kpi.averagePaymentTime} days` : "—"],
                    ["Validation period", comm.validationDays != null ? `${comm.validationDays} days` : "—"],
                    ["Deep linking", comm.deeplinkEnabled == null ? "—" : comm.deeplinkEnabled ? "Supported" : "Not supported"],
                    ["Currency", campaign.currency ?? "—"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline gap-4 px-5 py-3">
                      <span className="min-w-[160px] text-sm text-gray-500 shrink-0">{label}</span>
                      <span className={`text-sm ${label === "Commission rate" && value !== "—" ? "font-bold text-emerald-700" : "text-gray-800"}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-teal-100 bg-teal-50/60 px-5 py-3">
                  {comm.source === "linkhexa" ? (
                    <p className="text-xs text-teal-800">
                      EPC, KPIs, and creatives from Linkhexa <code className="text-[11px]">GET /api/v1/brands/{"{id}"}</code> (24h cache). Use Refresh to force Awin refetch on Linkhexa.
                    </p>
                  ) : comm.source === "description" ? (
                    <p className="text-xs text-amber-800">Partial data from programme description. Open again or Refresh — Linkhexa API may still return KPIs.</p>
                  ) : (
                    <p className="text-xs text-gray-500">No commission/KPI data yet. Check <code className="text-[11px]">LINKHEXA_API_KEY</code> and reload.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "creatives" && (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-50 px-5 py-4">
                <h2 className="font-extrabold text-gray-900">Promotions &amp; creatives</h2>
                <p className="mt-1 text-xs text-gray-400">From Linkhexa brand detail API</p>
              </div>
              {creatives.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-gray-400">No creatives for this programme.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {creatives.map((c) => (
                    <li key={c.promotionId} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-gray-900">{c.title}</p>
                          <p className="mt-0.5 text-xs text-gray-400 capitalize">{c.type}{c.voucherCode ? ` · ${c.voucherCode}` : ""}</p>
                          {c.description && <p className="mt-2 text-sm text-gray-600">{c.description}</p>}
                        </div>
                        {c.urlTracking && (
                          <button
                            type="button"
                            onClick={() => void copy(c.urlTracking!, `cr-${c.promotionId}`)}
                            className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
                          >
                            {copied === `cr-${c.promotionId}` ? "Copied" : "Copy link"}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "tracking" && (
            <div className="space-y-4">
              {applicationStatus === "approved" ? (
                <>
                  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
                    <p className="text-sm text-gray-500">Share the <strong>Earnytics</strong> short link below so clicks appear in Reports. It redirects through Linkhexa (<code className="text-xs">/go/p/slug</code>) with your slug as clickref.</p>
                    {createError && <p className="text-sm text-red-600">{createError}</p>}
                    {lastCreated && (
                      <div className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
                        <code className="flex-1 truncate text-sm text-teal-800">{lastCreated}</code>
                        <button onClick={() => void copy(lastCreated, "last")} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: accent }}>
                          {copied === "last" ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    )}
                    <button onClick={createLink} disabled={creating}
                      className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: accent }}>
                      {creating ? "Creating…" : goLinks.length > 0 ? "Create another link" : "Create tracking link"}
                    </button>
                  </div>
                  {goLinks.map((l) => {
                    const shareUrl = typeof window !== "undefined"
                      ? `${window.location.origin}/go/short/${l.slug}`
                      : `/go/short/${l.slug}`;
                    return (
                    <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-3">
                      <code className="flex-1 truncate text-sm text-teal-700">{shareUrl}</code>
                      <button onClick={() => void copy(shareUrl, l.id)} className="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold">
                        {copied === l.id ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    );
                  })}
                </>
              ) : (
                <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center text-gray-500">
                  {applicationStatus === "pending" ? "Application pending admin approval." : "Apply to join this programme first."}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
