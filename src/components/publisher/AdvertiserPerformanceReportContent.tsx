"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type AdvertiserRow = {
  advertiserId: string;
  name: string;
  logoUrl?: string | null;
  network: "Impact" | "TradeTracker" | "PaidOnResults" | "Yieldkit";
  code?: string;
  clicks: number;
  sales: number;
  leads: number;
  revenueByCurrency: Record<string, number>;
  commissionByCurrency: Record<string, number>;
};

type ReportPayload = {
  from: string;
  to: string;
  fxUsdApproxAvailable?: boolean;
  attributedTransactionCount: number;
  diagnostics?: {
    trackingLinkCount: number;
    distinctSlugs: number;
    attributedTransactionsInRange: number;
    dbTransactionsWithPublisherIdInRange: number | null;
  };
  kpis: {
    totalClicks: number;
    sales: number;
    leads: number;
    revenueByCurrency: Record<string, number>;
    commissionByCurrency: Record<string, number>;
    revenueUsdApprox?: number;
    commissionUsdApprox?: number;
  };
  advertisers: AdvertiserRow[];
};

function defaultRangeYmd(): { from: string; to: string } {
  const to = new Date();
  to.setUTCHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 364);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function utcDayStart(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function toUtcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type DatePreset = "today" | "yesterday" | "last7" | "last30" | "thisMonth" | "lastMonth" | "currentYear" | "previousYear";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "currentYear", label: "Current Year" },
  { key: "previousYear", label: "Previous Year" },
];

function datePresetRange(preset: DatePreset): { from: string; to: string } {
  const today0 = utcDayStart();
  switch (preset) {
    case "today":
      return { from: toUtcYmd(today0), to: toUtcYmd(today0) };
    case "yesterday": {
      const y0 = new Date(today0);
      y0.setUTCDate(y0.getUTCDate() - 1);
      return { from: toUtcYmd(y0), to: toUtcYmd(y0) };
    }
    case "last7": {
      const f = new Date(today0);
      f.setUTCDate(f.getUTCDate() - 6);
      return { from: toUtcYmd(f), to: toUtcYmd(today0) };
    }
    case "last30": {
      const f = new Date(today0);
      f.setUTCDate(f.getUTCDate() - 29);
      return { from: toUtcYmd(f), to: toUtcYmd(today0) };
    }
    case "thisMonth":
      return { from: toUtcYmd(new Date(Date.UTC(today0.getUTCFullYear(), today0.getUTCMonth(), 1))), to: toUtcYmd(today0) };
    case "lastMonth": {
      const s = new Date(Date.UTC(today0.getUTCFullYear(), today0.getUTCMonth() - 1, 1));
      const e = new Date(Date.UTC(today0.getUTCFullYear(), today0.getUTCMonth(), 0));
      return { from: toUtcYmd(s), to: toUtcYmd(e) };
    }
    case "currentYear":
      return { from: toUtcYmd(new Date(Date.UTC(today0.getUTCFullYear(), 0, 1))), to: toUtcYmd(today0) };
    case "previousYear": {
      const y = today0.getUTCFullYear() - 1;
      return { from: toUtcYmd(new Date(Date.UTC(y, 0, 1))), to: toUtcYmd(new Date(Date.UTC(y, 11, 31))) };
    }
  }
}

function formatMoney(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/** Sum per currency — not FX-converted across currencies. */
function formatCurrencyBucket(ob: Record<string, number> | undefined): string {
  if (!ob) return "—";
  const entries = Object.entries(ob).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return "—";
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return entries.map(([c, v]) => formatMoney(v, c)).join(" · ");
}

function bucketToCsvCell(ob: Record<string, number>): string {
  const s = Object.entries(ob)
    .filter(([, v]) => Number(v) > 0)
    .map(([c, v]) => `${c}:${Number(v).toFixed(2)}`)
    .join("; ");
  return `"${(s || "—").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const card = "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";
const kpiCard = "rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 sm:min-h-[100px]";

export default function AdvertiserPerformanceReportContent() {
  const defaults = useMemo(() => defaultRangeYmd(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);

  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [presetOpen, setPresetOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null);
  const presetRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: f, to: t });
      const res = await fetch(`/api/publisher/reports/advertiser-performance?${params}`, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as ReportPayload & { error?: string };
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not load report.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Could not load report.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(appliedFrom, appliedTo);
  }, [load, appliedFrom, appliedTo]);

  const filtered = useMemo(() => {
    const rows = data?.advertisers ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || String(r.advertiserId).includes(q)
    );
  }, [data, filter]);

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize, data]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageSafe = Math.min(page, totalPages);
  const slice = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const visiblePages = useMemo(() => {
    const total = totalPages;
    const c = pageSafe;
    if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1) as (number | "gap")[];
    const set = new Set<number>();
    set.add(1);
    set.add(total);
    for (let i = c - 2; i <= c + 2; i++) {
      if (i >= 1 && i <= total) set.add(i);
    }
    const sorted = [...set].sort((a, b) => a - b);
    const out: (number | "gap")[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i]!;
      if (i > 0 && v - sorted[i - 1]! > 1) out.push("gap");
      out.push(v);
    }
    return out;
  }, [totalPages, pageSafe]);

  const exportCsv = () => {
    if (!data) return;
    const header = [
      "Advertiser",
      "Clicks",
      "Sales",
      "Leads",
      "Revenue (by currency)",
      "Commission (by currency)",
    ];
    const lines = filtered.map((r) =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        r.clicks,
        r.sales,
        r.leads,
        bucketToCsvCell(r.revenueByCurrency),
        bucketToCsvCell(r.commissionByCurrency),
      ].join(",")
    );
    downloadCsv(`linkhexa-advertiser-performance-${data.from}_${data.to}.csv`, [header.join(","), ...lines].join("\n"));
  };

  const applyRange = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  const applyDatePreset = (preset: DatePreset) => {
    const { from: f, to: t } = datePresetRange(preset);
    setFrom(f);
    setTo(t);
    setAppliedFrom(f);
    setAppliedTo(t);
    setActivePreset(preset);
    setPresetOpen(false);
  };

  useEffect(() => {
    if (!presetOpen) return;
    function handleClick(e: MouseEvent) {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [presetOpen]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Reports</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Advertiser performance
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Clicks, sales, and revenue for <strong className="text-gray-700">your</strong> account only: same attribution as
            the dashboard (rows linked to your publisher id or your link slugs). Attribution happens after sync in our database.
          </p>
          {data && !loading && (
            <p className="mt-2 text-xs text-gray-400">
              Attributed transactions in this range:{" "}
              <span className="font-mono text-gray-600">{data.attributedTransactionCount.toLocaleString()}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="relative" ref={presetRef}>
            <button
              type="button"
              onClick={() => setPresetOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-gray-800">
                {new Date(appliedFrom + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                {" "}&ndash;{" "}
                {new Date(appliedTo + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-gray-400 transition ${presetOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {presetOpen && (
              <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="border-b border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                      From
                      <input
                        type="date"
                        value={from}
                        onChange={(e) => { setFrom(e.target.value); setActivePreset(null); }}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-teal-400"
                      />
                    </label>
                    <span className="mt-4 text-gray-400">–</span>
                    <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                      To
                      <input
                        type="date"
                        value={to}
                        onChange={(e) => { setTo(e.target.value); setActivePreset(null); }}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-teal-400"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => { applyRange(); setActivePreset(null); setPresetOpen(false); }}
                    className="mt-2.5 w-full rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700"
                  >
                    Apply Custom Range
                  </button>
                </div>
                <div className="py-1">
                  {DATE_PRESETS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyDatePreset(key)}
                      className={`flex w-full items-center px-4 py-2.5 text-left text-sm transition ${
                        activePreset === key
                          ? "bg-teal-50 font-semibold text-teal-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!data || loading}
            onClick={() => exportCsv()}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-700" role="note">
        <span className="font-semibold text-sky-800">Notice · </span>
        Figures are from your Earnytics account: short-link <strong className="text-sky-900">clicks</strong> per brand, and{" "}
        <strong className="text-sky-900">Impact</strong>, <strong className="text-sky-900">TradeTracker</strong>, <strong className="text-sky-900">PaidOnResults</strong> &amp; <strong className="text-sky-900">Yieldkit</strong> transactions attributed to you.
        Payout policy and platform fees are defined in your publisher agreement — not shown as a split here. Native currencies are shown per row.
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "Total clicks", value: loading ? "…" : (data?.kpis.totalClicks ?? 0).toLocaleString() },
          { label: "Sales (txns)", value: loading ? "…" : (data?.kpis.sales ?? 0).toLocaleString() },
          { label: "Leads", value: loading ? "…" : (data?.kpis.leads ?? 0).toLocaleString() },
        ].map((kpi) => (
          <div key={kpi.label} className={kpiCard}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{kpi.label}</p>
            <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-gray-900 sm:text-2xl">
              {kpi.value}
            </p>
          </div>
        ))}

        {[
          { label: "Total revenue", bucket: data?.kpis.revenueByCurrency, usd: data?.kpis.revenueUsdApprox },
          { label: "Total commission", bucket: data?.kpis.commissionByCurrency, usd: data?.kpis.commissionUsdApprox },
        ].map((kpi) => (
          <div key={kpi.label} className={kpiCard}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{kpi.label}</p>
            <p className="mt-2 text-base font-bold tabular-nums leading-snug tracking-tight text-gray-900 sm:text-lg">
              {loading ? "…" : formatCurrencyBucket(kpi.bucket)}
            </p>
            {!loading && data?.fxUsdApproxAvailable && kpi.usd != null && kpi.usd > 0 && (
              <p className="mt-1 text-xs font-semibold tabular-nums text-emerald-600">
                ≈ {formatMoney(kpi.usd, "USD")}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className={card}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              placeholder="Filter by advertiser…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 sm:max-w-md"
            />
          </div>
          <p className="shrink-0 text-sm text-gray-500">
            <span className="font-medium text-gray-800">{filtered.length}</span> advertisers
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Advertiser</th>
                <th className="px-4 py-3 text-right">Clicks</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">Commission</th>
                <th className="px-4 py-3 text-right"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading…</td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-red-500">{error}</td>
                </tr>
              )}
              {!loading && !error && slice.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    No rows match this filter.{" "}
                    <Link href="/dashboard/brands" className="font-medium text-teal-600 hover:underline">
                      Browse brands
                    </Link>{" "}
                    to create links.
                  </td>
                </tr>
              )}
              {!loading && !error && slice.map((r) => {
                const brandHref = r.network === "TradeTracker"
                  ? `/dashboard/brands/tradetracker/${r.advertiserId}`
                  : r.network === "PaidOnResults"
                  ? `/dashboard/brands/por/${r.advertiserId}`
                  : r.network === "Yieldkit"
                  ? `/dashboard/brands/yieldkit/${r.advertiserId}`
                  : `/dashboard/brands/impact/${r.advertiserId}`;
                return (
                  <tr key={`${r.network}-${r.advertiserId}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {r.logoUrl ? (
                          <img src={r.logoUrl} alt={r.name}
                            className="h-7 w-7 rounded-lg border border-gray-100 object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
                            style={{ background: "linear-gradient(135deg,#0d9488,#059669)" }}>
                            {r.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{r.name}</p>
                          <span className={`text-[10px] font-semibold ${
                            r.network === "TradeTracker"  ? "text-purple-600"
                            : r.network === "PaidOnResults" ? "text-orange-600"
                            : r.network === "Yieldkit"    ? "text-indigo-600"
                            : "text-blue-600"}`}>
                            {r.network}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-gray-800">{r.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-600">{r.sales.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500">{r.leads}</td>
                    <td className="max-w-[220px] px-4 py-3 text-right text-xs font-medium leading-snug text-teal-700 sm:text-sm">
                      {formatCurrencyBucket(r.revenueByCurrency)}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-right text-xs font-medium leading-snug text-gray-800 sm:text-sm">
                      {formatCurrencyBucket(r.commissionByCurrency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={brandHref}
                        className="text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700">
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-1">
            {visiblePages.map((p, idx) =>
              p === "gap" ? (
                <span key={`gap-${idx}`} className="px-1 text-gray-400">…</span>
              ) : (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`min-w-[2.25rem] rounded-lg px-2.5 py-1.5 text-sm font-medium transition ${
                    p === pageSafe
                      ? "bg-teal-600 text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}>
                  {p}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
