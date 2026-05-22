"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────── */
type DashboardStats = {
  profiles: {
    total: number; publishers: number; advertisers: number;
    pending: number; approved: number; rejected: number;
  };
  publisherGoLinks: { count: number; totalClicks: number };
  brandApplications: { total: number; pending: number; approved: number; rejected: number };
  awinProgrammesCached: number;
  impactReporting?: {
    actionsStored: number; actionsAttributed: number;
    campaignsCached: number;
    lastSyncAt: string | null; lastSyncError: string | null;
    applicationsPending: number; applicationsApproved: number;
  };
  pendingSignups: { id: string; username: string; email: string; role: string; created_at: string }[];
  financials: {
    commissionByCurrency: Record<string, number>;
    saleByCurrency: Record<string, number>;
    totalPublisherPayoutUsd: number;
    totalGrossOnLinksUsd: number | null;
    primaryCurrency: string | null;
    primaryCommission: number;
    primarySale: number;
    source?: "rollup" | "awin_transactions";
  };
  awinReporting: {
    transactionsStored: number; transactionsAttributed: number;
    lastSyncAt: string | null; lastSyncError: string | null;
  };
  awinActivityLast30Days: {
    fromYmd: string; toYmd: string;
    transactionCount: number; transactionCountAttributed: number;
    saleByCurrency: Record<string, number>; commissionByCurrency: Record<string, number>;
    primarySaleCurrency: string | null; primarySale: number;
    primaryCommissionCurrency: string | null; primaryCommission: number;
  };
  awinSyncOnDashboardLoad?: { ran: boolean; skippedReason?: string; error?: string };
  linkhexaReporting?: {
    programmesCached: number;
    activeProgrammes: number;
    transactionsStored: number;
    trackingLinks: number;
    lastSyncAt: string | null;
    lastSyncError: string | null;
  };
};

type PublisherEarningRow = {
  publisherId: string; username: string; email: string;
  commissionByCurrency: Record<string, number>; saleByCurrency: Record<string, number>;
};

type TTStats = {
  transactions: { total: number; accepted: number; pending: number; rejected: number; attributed: number };
  campaigns:    { total: number; accepted: number };
  revenue:      { totalCommission: number; attributedEarnings: number };
  lastSync:     { syncedAt: string } | null;
};

type PORStats = {
  totalMerchants: number; joinedMerchants: number;
  totalTransactions: number; pendingApplications: number;
  commissionByCurrency: Record<string, number>;
  lastSyncAt: string | null; lastSyncError: string | null;
};

type YKStats = {
  totalCampaigns: number; activeCampaigns: number;
  totalTransactions: number; pendingApplications: number;
  commissionByCurrency: Record<string, number>;
  lastSyncAt: string | null; lastSyncError: string | null;
};

/* ─── Helpers ──────────────────────────────────────────── */
function formatMoney(n: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
}
function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/* ─── Premium KPI card ─────────────────────────────────── */
function KpiCard({
  label, value, icon, accent = "teal", alert = false,
}: {
  label: string; value: string | number;
  icon: string; accent?: "teal" | "amber" | "blue" | "rose" | "emerald";
  alert?: boolean;
}) {
  const accents: Record<string, { bg: string; text: string; ring: string; iconBg: string }> = {
    teal:    { bg: "bg-teal-50",   text: "text-teal-700",   ring: "ring-teal-100",   iconBg: "from-teal-500 to-emerald-500" },
    amber:   { bg: "bg-amber-50",  text: "text-amber-700",  ring: "ring-amber-100",  iconBg: "from-amber-400 to-orange-500" },
    blue:    { bg: "bg-blue-50",   text: "text-blue-700",   ring: "ring-blue-100",   iconBg: "from-blue-500 to-indigo-500" },
    rose:    { bg: "bg-rose-50",   text: "text-rose-700",   ring: "ring-rose-100",   iconBg: "from-rose-500 to-pink-500" },
    emerald: { bg: "bg-emerald-50",text: "text-emerald-700",ring: "ring-emerald-100",iconBg: "from-emerald-500 to-teal-500" },
  };
  const a = accents[accent];
  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
      alert ? "ring-2 ring-amber-300 shadow-md shadow-amber-100" : "border border-gray-100 shadow-sm hover:border-teal-100"
    }`}>
      {/* Top gradient line */}
      <div className="h-[3px] w-full" style={{ background: alert
        ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
        : accent === "teal" ? "linear-gradient(90deg,#0d9488,#059669)"
        : accent === "blue" ? "linear-gradient(90deg,#3b82f6,#6366f1)"
        : accent === "amber" ? "linear-gradient(90deg,#f59e0b,#f97316)"
        : accent === "emerald" ? "linear-gradient(90deg,#10b981,#0d9488)"
        : "linear-gradient(90deg,#f43f5e,#ec4899)"
      }} />
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">{label}</p>
            <p className={`mt-2 text-3xl font-extrabold tabular-nums tracking-tight ${alert ? "text-amber-600" : "text-gray-900"}`}
              style={{ letterSpacing: "-0.03em" }}>
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${a.iconBg}`}>
            <svg className="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section title ────────────────────────────────────── */
function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full" style={{ background: "linear-gradient(180deg,#0d9488,#059669)" }} />
        <h2 className="text-base font-extrabold tracking-tight text-gray-900" style={{ letterSpacing: "-0.02em" }}>
          {children}
        </h2>
      </div>
      {sub && <p className="mt-1 pl-4 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

/* ─── Finance card ─────────────────────────────────────── */
function FinanceCard({
  title, primary, sub, children,
}: { title: string; primary: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#0d9488,#059669,#0891b2)" }} />
      <div className="p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">{title}</p>
        <p className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900" style={{ letterSpacing: "-0.03em" }}>
          {primary}
        </p>
        {sub && <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">{sub}</p>}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

/* ─── Action button ────────────────────────────────────── */
function ActionBtn({ onClick, disabled, children, variant = "primary" }: {
  onClick: () => void; disabled?: boolean;
  children: React.ReactNode; variant?: "primary" | "ghost";
}) {
  if (variant === "ghost") {
    return (
      <button type="button" onClick={onClick} disabled={disabled}
        className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-40">
        {children}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="mt-3 flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-40"
      style={{ background: "linear-gradient(135deg,#0d9488,#059669)" }}>
      {children}
    </button>
  );
}

/* ─── Table wrapper ────────────────────────────────────── */
function AdminTable({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100" style={{ background: "linear-gradient(90deg,#f0fdf9,#f5f9ff)" }}>
            {heads.map((h, i) => (
              <th key={i} className={`px-4 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-gray-400 ${i === heads.length - 1 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────── */
export default function AdminDashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ttStats, setTtStats] = useState<TTStats | null>(null);
  const [porStats, setPorStats] = useState<PORStats | null>(null);
  const [ykStats,  setYkStats]  = useState<YKStats  | null>(null);
  const [admitadStats, setAdmitadStats] = useState<{ totalCampaigns: number; activeCampaigns: number; totalTransactions: number; pendingApplications: number; commissionByCurrency: Record<string, number>; lastSyncAt: string | null; lastSyncError: string | null } | null>(null);
  const [lhStats, setLhStats] = useState<{ totalProgrammes: number; activeProgrammes: number; totalTransactions: number; pendingApplications: number; trackingLinks?: number; totalClicks?: number; commissionByCurrency: Record<string, number>; lastSyncAt: string | null; lastSyncError: string | null } | null>(null);
  const [publishersEarnings, setPublishersEarnings] = useState<PublisherEarningRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [dashRes, pubRes, ttRes, porRes, ykRes, adRes, lhRes] = await Promise.all([
          fetch("/api/admin/dashboard-stats", { credentials: "include" }),
          fetch("/api/admin/publishers-earnings?days=30", { credentials: "include" }),
          fetch("/api/admin/tradetracker/stats", { credentials: "include" }),
          fetch("/api/admin/por/stats", { credentials: "include" }),
          fetch("/api/admin/yieldkit/stats", { credentials: "include" }),
          fetch("/api/admin/admitad/stats", { credentials: "include" }),
          fetch("/api/admin/linkhexa/stats", { credentials: "include" }),
        ]);
        const dashData = await dashRes.json().catch(() => ({}));
        const pubData  = await pubRes.json().catch(() => ({}));
        const ttData   = await ttRes.json().catch(() => ({}));
        const porData  = await porRes.json().catch(() => ({}));
        const ykData   = await ykRes.json().catch(() => ({}));
        const adData   = await adRes.json().catch(() => ({}));
        const lhData   = await lhRes.json().catch(() => ({}));
        if (!dashRes.ok) { if (!cancelled) setError(dashData.error ?? "Could not load stats"); return; }
        if (!cancelled) {
          setStats(dashData as DashboardStats);
          setPublishersEarnings(Array.isArray(pubData.publishers) ? pubData.publishers : []);
          if (ttRes.ok)  setTtStats(ttData as TTStats);
          if (porRes.ok) setPorStats(porData as PORStats);
          if (ykRes.ok)  setYkStats(ykData as YKStats);
          if (adRes.ok)  setAdmitadStats(adData);
          if (lhRes.ok)  setLhStats(lhData);
          else if ((dashData as DashboardStats).linkhexaReporting) {
            const r = (dashData as DashboardStats).linkhexaReporting!;
            setLhStats({
              totalProgrammes: r.programmesCached,
              activeProgrammes: r.activeProgrammes,
              totalTransactions: r.transactionsStored,
              pendingApplications: 0,
              trackingLinks: r.trackingLinks,
              totalClicks: 0,
              commissionByCurrency: {},
              lastSyncAt: r.lastSyncAt,
              lastSyncError: r.lastSyncError,
            });
          }
        }
      } catch { if (!cancelled) setError("Could not load stats"); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshStats = async () => {
    const [dashRes, pubRes, ttRes, porRes, ykRes, adRes, lhRes] = await Promise.all([
      fetch("/api/admin/dashboard-stats", { credentials: "include" }),
      fetch("/api/admin/publishers-earnings?days=30", { credentials: "include" }),
      fetch("/api/admin/tradetracker/stats", { credentials: "include" }),
      fetch("/api/admin/por/stats", { credentials: "include" }),
      fetch("/api/admin/yieldkit/stats", { credentials: "include" }),
      fetch("/api/admin/admitad/stats", { credentials: "include" }),
      fetch("/api/admin/linkhexa/stats", { credentials: "include" }),
    ]);
    if (dashRes.ok) setStats((await dashRes.json()) as DashboardStats);
    if (pubRes.ok) { const p = await pubRes.json(); setPublishersEarnings(Array.isArray(p.publishers) ? p.publishers : []); }
    if (ttRes.ok)  setTtStats((await ttRes.json()) as TTStats);
    if (porRes.ok) setPorStats((await porRes.json()) as PORStats);
    if (ykRes.ok)  setYkStats((await ykRes.json()) as YKStats);
    if (adRes.ok)  setAdmitadStats(await adRes.json());
    if (lhRes.ok) {
      setLhStats(await lhRes.json());
    } else if (stats?.linkhexaReporting) {
      const r = stats.linkhexaReporting;
      setLhStats({
        totalProgrammes: r.programmesCached,
        activeProgrammes: r.activeProgrammes,
        totalTransactions: r.transactionsStored,
        pendingApplications: 0,
        trackingLinks: r.trackingLinks,
        totalClicks: 0,
        commissionByCurrency: {},
        lastSyncAt: r.lastSyncAt,
        lastSyncError: r.lastSyncError,
      });
    }
  };

  /* icons */
  const ICONS = {
    users:   "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z",
    pub:     "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
    clock:   "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
    check:   "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    x:       "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    store:   "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z",
    link:    "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
    cursor:  "M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5",
    app:     "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z",
  };

  return (
    <div className="space-y-10">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-teal-600">Overview</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900" style={{ letterSpacing: "-0.03em" }}>
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Live totals from Supabase. Commissions refresh when you run a transaction sync.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-teal-100 bg-teal-50/60 px-4 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
          <span className="text-xs font-semibold text-teal-700">Live data</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600" />
          Loading dashboard…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {stats && !loading && (
        <>
          {/* ── Row 1: User stats ── */}
          <section>
            <SectionTitle sub="Real-time counts from the users table">User overview</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Total users"    value={stats.profiles.total}      icon={ICONS.users}  accent="teal" />
              <KpiCard label="Publishers"     value={stats.profiles.publishers} icon={ICONS.pub}    accent="blue" />
              <KpiCard label="Pending approval" value={stats.profiles.pending}  icon={ICONS.clock}  accent="amber" alert={stats.profiles.pending > 0} />
              <KpiCard label="Approved"       value={stats.profiles.approved}   icon={ICONS.check}  accent="emerald" />
              <KpiCard label="Rejected"       value={stats.profiles.rejected}   icon={ICONS.x}      accent="rose" />
              <KpiCard label="Advertisers"    value={stats.profiles.advertisers}icon={ICONS.store}  accent="blue" />
            </div>
          </section>

          {/* ── Row 2: Link & app stats ── */}
          <section>
            <SectionTitle sub="Brand applications, tracking links, and click activity">Links & applications</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              <KpiCard label="Brand apps total"  value={stats.brandApplications.total}    icon={ICONS.app}    accent="teal" />
              <KpiCard label="Tracking links"    value={stats.publisherGoLinks.count}     icon={ICONS.link}   accent="blue" />
              <KpiCard label="Total clicks"      value={stats.publisherGoLinks.totalClicks} icon={ICONS.cursor} accent="emerald" />
              <KpiCard label="Pending apps"      value={stats.brandApplications.pending}   icon={ICONS.clock}  accent="amber" alert={stats.brandApplications.pending > 0} />
              <KpiCard label="Approved apps"     value={stats.brandApplications.approved}  icon={ICONS.check}  accent="emerald" />
              <KpiCard label="Rejected apps"     value={stats.brandApplications.rejected}  icon={ICONS.x}      accent="rose" />
            </div>
          </section>

          {/* ── Finance cards ── */}
          <section>
            <SectionTitle sub="Impact · TradeTracker · PaidOnResults — run sync to refresh">Revenue & commissions</SectionTitle>

            {/* ── Impact ── */}
            <div className="grid gap-5 lg:grid-cols-2">
              <FinanceCard
                title="Impact — Attributed commissions"
                primary={stats.financials.primaryCurrency
                  ? formatMoney(stats.financials.primaryCommission, stats.financials.primaryCurrency)
                  : formatUsd(0)}
                sub={`USD: ${formatUsd(stats.financials.totalPublisherPayoutUsd)} · Other: ${
                  Object.entries(stats.financials.commissionByCurrency).filter(([c]) => c !== "USD")
                    .map(([c, v]) => `${c} ${v.toFixed(2)}`).join(", ") || "—"
                } · Last sync: ${stats.awinReporting.lastSyncAt ? new Date(stats.awinReporting.lastSyncAt).toLocaleString() : "never"}`}
              >
                <div className="flex flex-wrap gap-2">
                  <ActionBtn variant="primary" disabled={syncing !== null} onClick={async () => {
                    setSyncing("impact"); setSyncMessage(null);
                    try {
                      const res = await fetch("/api/admin/impact/sync-actions", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
                      const data = await res.json().catch(() => ({}));
                      setSyncMessage(res.ok ? `✓ Impact: ${data.fetched ?? 0} fetched, ${data.attributed ?? 0} attributed.` : `✗ ${data.error ?? "Sync failed"}`);
                      if (res.ok) await refreshStats();
                    } catch { setSyncMessage("✗ Sync request failed"); }
                    finally { setSyncing(null); }
                  }}>
                    {syncing === "impact" ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Syncing…</> : "Sync Impact"}
                  </ActionBtn>
                  <ActionBtn variant="ghost" disabled={rebuilding} onClick={async () => {
                    setRebuilding(true); setSyncMessage(null);
                    try {
                      const res = await fetch("/api/admin/impact/rebuild-rollup", { method: "POST", credentials: "include" });
                      const data = await res.json().catch(() => ({}));
                      setSyncMessage(res.ok ? "✓ Impact rollup rebuilt." : `✗ ${data.error ?? "Rebuild failed"}`);
                      if (res.ok) await refreshStats();
                    } catch { setSyncMessage("✗ Rebuild failed"); }
                    finally { setRebuilding(false); }
                  }}>
                    {rebuilding ? "Rebuilding…" : "Rebuild rollup"}
                  </ActionBtn>
                </div>
                {syncMessage && (
                  <p className={`mt-2 text-xs font-medium ${syncMessage.startsWith("✓") ? "text-teal-600" : "text-red-500"}`}>{syncMessage}</p>
                )}
              </FinanceCard>

              <FinanceCard
                title="Impact — Sale value"
                primary={stats.financials.primaryCurrency ? formatMoney(stats.financials.primarySale, stats.financials.primaryCurrency) : "—"}
                sub={`${stats.awinReporting.transactionsStored.toLocaleString()} actions stored · ${stats.awinReporting.transactionsAttributed.toLocaleString()} attributed`}
              >
                {stats.awinReporting.lastSyncError && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">Last error: {stats.awinReporting.lastSyncError}</p>
                )}
              </FinanceCard>
            </div>

            {/* ── TradeTracker ── */}
            {ttStats && (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <FinanceCard
                  title="TradeTracker — Total commissions"
                  primary={`€${ttStats.revenue.totalCommission.toLocaleString("en-EU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  sub={`${ttStats.transactions.accepted.toLocaleString()} accepted · ${ttStats.transactions.attributed.toLocaleString()} attributed · ${ttStats.campaigns.accepted.toLocaleString()} campaigns`}
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn variant="primary" disabled={syncing !== null} onClick={async () => {
                      setSyncing("tt"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/tradetracker/sync-transactions", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ TT: ${data.synced ?? data.upserted ?? 0} transactions synced.` : `✗ ${data.error ?? "Sync failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ TT sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "tt" ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Syncing…</> : "Sync TradeTracker"}
                    </ActionBtn>
                    {ttStats.lastSync && (
                      <span className="self-center text-[10px] text-gray-400">
                        Last: {new Date(ttStats.lastSync.syncedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </FinanceCard>
                <FinanceCard
                  title="TradeTracker — Publisher earnings"
                  primary={`€${ttStats.revenue.attributedEarnings.toLocaleString("en-EU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  sub={`${ttStats.transactions.total.toLocaleString()} total · ${ttStats.transactions.pending.toLocaleString()} pending · ${ttStats.transactions.rejected.toLocaleString()} rejected`}
                />
              </div>
            )}

            {/* ── PaidOnResults ── */}
            {porStats && (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <FinanceCard
                  title="PaidOnResults — Commissions"
                  primary={Object.entries(porStats.commissionByCurrency).length > 0
                    ? Object.entries(porStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ")
                    : "£0.00"}
                  sub={`${porStats.totalTransactions.toLocaleString()} transactions · ${porStats.joinedMerchants.toLocaleString()} joined merchants · Last sync: ${porStats.lastSyncAt ? new Date(porStats.lastSyncAt).toLocaleString() : "never"}`}
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn variant="primary" disabled={syncing !== null} onClick={async () => {
                      setSyncing("por"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/por/sync-transactions", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ POR: ${data.upserted ?? 0} transactions synced.` : `✗ ${data.error ?? "Sync failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ POR sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "por" ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Syncing…</> : "Sync PaidOnResults"}
                    </ActionBtn>
                    <ActionBtn variant="ghost" disabled={syncing !== null} onClick={async () => {
                      setSyncing("por-merchants"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/por/sync-merchants", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ POR: ${data.upserted ?? 0} merchants synced.` : `✗ ${data.error ?? "Failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ POR merchant sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "por-merchants" ? "Syncing…" : "Sync merchants"}
                    </ActionBtn>
                  </div>
                  {porStats.lastSyncError && (
                    <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">Last error: {porStats.lastSyncError}</p>
                  )}
                </FinanceCard>
                <FinanceCard
                  title="PaidOnResults — Merchants"
                  primary={porStats.totalMerchants.toLocaleString()}
                  sub={`${porStats.joinedMerchants.toLocaleString()} joined · ${porStats.pendingApplications.toLocaleString()} pending publisher applications`}
                />
              </div>
            )}

            {/* ── Yieldkit ── */}
            {ykStats && (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <FinanceCard
                  title="Yieldkit — Commissions"
                  primary={Object.entries(ykStats.commissionByCurrency).length > 0
                    ? Object.entries(ykStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ")
                    : "$0.00"}
                  sub={`${ykStats.totalTransactions.toLocaleString()} transactions · ${ykStats.activeCampaigns.toLocaleString()} active campaigns · Last sync: ${ykStats.lastSyncAt ? new Date(ykStats.lastSyncAt).toLocaleString() : "never"}`}
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn variant="primary" disabled={syncing !== null} onClick={async () => {
                      setSyncing("yk-txn"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/yieldkit/sync-transactions", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ Yieldkit: ${data.upserted ?? 0} transactions synced.` : `✗ ${data.error ?? "Sync failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ Yieldkit sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "yk-txn" ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Syncing…</> : "Sync Transactions"}
                    </ActionBtn>
                    <ActionBtn variant="ghost" disabled={syncing !== null} onClick={async () => {
                      setSyncing("yk-campaigns"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/yieldkit/sync-campaigns", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ Yieldkit: ${data.upserted ?? 0} campaigns synced.` : `✗ ${data.error ?? "Failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ Yieldkit campaign sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "yk-campaigns" ? "Syncing…" : "Sync Campaigns"}
                    </ActionBtn>
                  </div>
                  {ykStats.lastSyncError && (
                    <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">Last error: {ykStats.lastSyncError}</p>
                  )}
                </FinanceCard>
                <FinanceCard
                  title="Yieldkit — Campaigns"
                  primary={ykStats.totalCampaigns.toLocaleString()}
                  sub={`${ykStats.activeCampaigns.toLocaleString()} active · ${ykStats.pendingApplications.toLocaleString()} pending publisher applications`}
                />
              </div>
            )}
          </section>

          {/* ── Linkhexa ── */}
          {lhStats && (
            <section>
              <SectionTitle sub="Linkhexa Partner API (Awin catalogue)">Linkhexa</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FinanceCard
                  title="Linkhexa — Commissions"
                  primary={Object.entries(lhStats.commissionByCurrency).length > 0
                    ? Object.entries(lhStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ")
                    : "—"}
                  sub={`${lhStats.totalTransactions.toLocaleString()} transactions · Last sync: ${lhStats.lastSyncAt ? new Date(lhStats.lastSyncAt).toLocaleString() : "never"}`}
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn variant="primary" disabled={syncing !== null} onClick={async () => {
                      setSyncing("lh-txn"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/linkhexa/sync-transactions", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ Linkhexa: ${data.upserted ?? 0} transactions synced.` : `✗ ${data.error ?? "Sync failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ Linkhexa sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "lh-txn" ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Syncing…</> : "Sync Transactions"}
                    </ActionBtn>
                    <ActionBtn variant="ghost" disabled={syncing !== null} onClick={async () => {
                      setSyncing("lh-programmes"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/linkhexa/sync-campaigns", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ Linkhexa: ${data.upserted ?? 0} programmes synced.` : `✗ ${data.error ?? "Failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ Linkhexa programme sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "lh-programmes" ? "Syncing…" : "Sync Programmes"}
                    </ActionBtn>
                  </div>
                  {lhStats.lastSyncError && (
                    <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">Last error: {lhStats.lastSyncError}</p>
                  )}
                </FinanceCard>
                <FinanceCard
                  title="Linkhexa — Programmes"
                  primary={lhStats.totalProgrammes.toLocaleString()}
                  sub={`${lhStats.activeProgrammes.toLocaleString()} active · ${lhStats.pendingApplications.toLocaleString()} pending publisher applications`}
                />
              </div>
            </section>
          )}

          {/* ── Admitad ── */}
          {admitadStats && (
            <section>
              <SectionTitle sub="Admitad affiliate network">Admitad</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FinanceCard
                  title="Admitad — Commissions"
                  primary={Object.entries(admitadStats.commissionByCurrency).length > 0
                    ? Object.entries(admitadStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ")
                    : "—"}
                  sub={`${admitadStats.totalTransactions.toLocaleString()} transactions · Last sync: ${admitadStats.lastSyncAt ? new Date(admitadStats.lastSyncAt).toLocaleString() : "never"}`}
                >
                  <div className="flex flex-wrap gap-2">
                    <ActionBtn variant="primary" disabled={syncing !== null} onClick={async () => {
                      setSyncing("admitad-txn"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/admitad/sync-transactions", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ Admitad: ${data.upserted ?? 0} transactions synced.` : `✗ ${data.error ?? "Sync failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ Admitad sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "admitad-txn" ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Syncing…</> : "Sync Transactions"}
                    </ActionBtn>
                    <ActionBtn variant="ghost" disabled={syncing !== null} onClick={async () => {
                      setSyncing("admitad-campaigns"); setSyncMessage(null);
                      try {
                        const res = await fetch("/api/admin/admitad/sync-campaigns", { method: "POST", credentials: "include" });
                        const data = await res.json().catch(() => ({}));
                        setSyncMessage(res.ok ? `✓ Admitad: ${data.upserted ?? 0} campaigns synced.` : `✗ ${data.error ?? "Failed"}`);
                        if (res.ok) await refreshStats();
                      } catch { setSyncMessage("✗ Admitad campaign sync failed"); }
                      finally { setSyncing(null); }
                    }}>
                      {syncing === "admitad-campaigns" ? "Syncing…" : "Sync Campaigns"}
                    </ActionBtn>
                  </div>
                  {admitadStats.lastSyncError && (
                    <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">Last error: {admitadStats.lastSyncError}</p>
                  )}
                </FinanceCard>
                <FinanceCard
                  title="Admitad — Campaigns"
                  primary={admitadStats.totalCampaigns.toLocaleString()}
                  sub={`${admitadStats.activeCampaigns.toLocaleString()} active · ${admitadStats.pendingApplications.toLocaleString()} pending publisher applications`}
                />
              </div>
            </section>
          )}

          {/* ── Publishers earnings table ── */}
          {publishersEarnings.length > 0 && (
            <section>
              <SectionTitle sub="From impact_publisher_earnings_daily rollup — attributed actions only">
                Publisher earnings (last 30 days)
              </SectionTitle>
              <AdminTable heads={["Publisher", "Sale (gross) by currency", "Commission by currency"]}>
                {publishersEarnings.slice(0, 25).map((p) => (
                  <tr key={p.publisherId} className="border-b border-gray-50 transition-colors hover:bg-teal-50/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{p.username}</p>
                      <p className="text-[11px] text-gray-400">{p.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-medium tabular-nums text-teal-600">
                      {Object.entries(p.saleByCurrency ?? {}).filter(([, v]) => v > 0).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-gray-700">
                      {Object.entries(p.commissionByCurrency).filter(([, v]) => v > 0).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </section>
          )}

          {/* ── Activity by platform ── */}
          <section>
            <SectionTitle sub="Impact rolling last 30 days — all synced actions, not split by publisher">
              Activity by platform
            </SectionTitle>
            {stats.awinSyncOnDashboardLoad?.skippedReason && !stats.awinSyncOnDashboardLoad.ran && (
              <p className="mb-3 text-xs text-gray-400">{stats.awinSyncOnDashboardLoad.skippedReason}</p>
            )}
            {stats.awinSyncOnDashboardLoad?.error && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Auto-sync: {stats.awinSyncOnDashboardLoad.error}
              </p>
            )}
            <AdminTable heads={["Platform", "Campaigns", "Links", "Clicks", "Transactions", "Attributed", "Payout"]}>
              {/* Impact row */}
              <tr className="border-b border-gray-50 transition-colors hover:bg-teal-50/40">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-100 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400" /> Impact
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">
                  {(stats.impactReporting?.campaignsCached ?? stats.awinProgrammesCached).toLocaleString()}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">{stats.publisherGoLinks.count.toLocaleString()}</td>
                <td className="px-4 py-3 font-bold tabular-nums text-teal-600">{stats.publisherGoLinks.totalClicks.toLocaleString()}</td>
                <td className="px-4 py-3 tabular-nums text-gray-600">
                  {stats.awinActivityLast30Days.transactionCount.toLocaleString()}
                  {stats.awinActivityLast30Days.transactionCountAttributed > 0 && (
                    <span className="mt-0.5 block text-[10px] text-gray-400">
                      {stats.awinActivityLast30Days.transactionCountAttributed.toLocaleString()} matched
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-teal-600">
                  {stats.awinActivityLast30Days.primarySaleCurrency && stats.awinActivityLast30Days.primarySale > 0
                    ? formatMoney(stats.awinActivityLast30Days.primarySale, stats.awinActivityLast30Days.primarySaleCurrency)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                  {stats.awinActivityLast30Days.primaryCommissionCurrency && stats.awinActivityLast30Days.primaryCommission > 0
                    ? formatMoney(stats.awinActivityLast30Days.primaryCommission, stats.awinActivityLast30Days.primaryCommissionCurrency)
                    : formatUsd(0)}
                </td>
              </tr>
              {/* TradeTracker row */}
              {ttStats && (
                <tr className="border-b border-gray-50 transition-colors hover:bg-blue-50/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> TradeTracker
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {ttStats.campaigns.accepted.toLocaleString()}
                    <span className="mt-0.5 block text-[10px] text-gray-400">{ttStats.campaigns.total.toLocaleString()} total</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {ttStats.transactions.total.toLocaleString()}
                    {ttStats.transactions.attributed > 0 && (
                      <span className="mt-0.5 block text-[10px] text-gray-400">{ttStats.transactions.attributed.toLocaleString()} matched</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-blue-600">
                    {ttStats.revenue.attributedEarnings > 0 ? `€${ttStats.revenue.attributedEarnings.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                    €{ttStats.revenue.totalCommission.toFixed(2)}
                  </td>
                </tr>
              )}
              {/* PaidOnResults row */}
              {porStats && (
                <tr className="border-b border-gray-50 transition-colors hover:bg-orange-50/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> PaidOnResults
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {porStats.joinedMerchants.toLocaleString()}
                    <span className="mt-0.5 block text-[10px] text-gray-400">{porStats.totalMerchants.toLocaleString()} total</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {porStats.totalTransactions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-orange-600">
                    {Object.entries(porStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                    {Object.entries(porStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—"}
                  </td>
                </tr>
              )}
              {/* Yieldkit row */}
              {ykStats && (
                <tr className="border-b border-gray-50 transition-colors hover:bg-indigo-50/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> Yieldkit
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {ykStats.activeCampaigns.toLocaleString()}
                    <span className="mt-0.5 block text-[10px] text-gray-400">{ykStats.totalCampaigns.toLocaleString()} total</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {ykStats.totalTransactions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-indigo-600">
                    {Object.entries(ykStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                    {Object.entries(ykStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—"}
                  </td>
                </tr>
              )}
              {/* Admitad row */}
              {admitadStats && (
                <tr className="border-b border-gray-50 transition-colors hover:bg-violet-50/30">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> Admitad
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {admitadStats.activeCampaigns.toLocaleString()}
                    <span className="mt-0.5 block text-[10px] text-gray-400">{admitadStats.totalCampaigns.toLocaleString()} total</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {admitadStats.totalTransactions.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-violet-600">
                    {Object.entries(admitadStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                    {Object.entries(admitadStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ") || formatUsd(0)}
                  </td>
                </tr>
              )}
              {/* Linkhexa row — always visible */}
              {(() => {
                const lh = lhStats ?? (stats.linkhexaReporting ? {
                  totalProgrammes: stats.linkhexaReporting.programmesCached,
                  activeProgrammes: stats.linkhexaReporting.activeProgrammes,
                  totalTransactions: stats.linkhexaReporting.transactionsStored,
                  trackingLinks: stats.linkhexaReporting.trackingLinks,
                  totalClicks: 0,
                  commissionByCurrency: {} as Record<string, number>,
                } : null);
                return (
              <tr className="border-b border-gray-50 transition-colors hover:bg-teal-50/30">
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> Linkhexa
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">
                  {(lh?.activeProgrammes ?? 0).toLocaleString()}
                  <span className="mt-0.5 block text-[10px] text-gray-400">
                    {(lh?.totalProgrammes ?? 0).toLocaleString()} total
                    {!lh && (
                      <span className="text-amber-600"> · reload page</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">
                  {(lh?.trackingLinks ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 tabular-nums text-teal-600">
                  {(lh?.totalClicks ?? 0) > 0 ? (lh!.totalClicks ?? 0).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-gray-600">
                  {(lh?.totalTransactions ?? 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium tabular-nums text-teal-600">—</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                  {lhStats && Object.keys(lhStats.commissionByCurrency).length > 0
                    ? Object.entries(lhStats.commissionByCurrency).map(([c, v]) => `${c} ${v.toFixed(2)}`).join(" · ")
                    : formatUsd(0)}
                </td>
              </tr>
                );
              })()}
            </AdminTable>
            <p className="mt-2 text-[10px] text-gray-400">
              Window: {stats.awinActivityLast30Days.fromYmd} → {stats.awinActivityLast30Days.toYmd} UTC
            </p>
          </section>

          {/* ── Pending approvals ── */}
          <section>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-1 rounded-full" style={{ background: "linear-gradient(180deg,#0d9488,#059669)" }} />
                  <h2 className="text-base font-extrabold tracking-tight text-gray-900" style={{ letterSpacing: "-0.02em" }}>
                    Pending publisher approvals
                    {stats.pendingSignups.length > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-600">
                        {stats.pendingSignups.length}
                      </span>
                    )}
                  </h2>
                </div>
              </div>
              <Link href="/admin#admin-all-signups"
                className="flex items-center gap-1 rounded-xl border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100">
                View all
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>

            {stats.pendingSignups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg,#0d9488,#059669)" }}>
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-400">All caught up — no pending approvals</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <ul className="divide-y divide-gray-50">
                  {stats.pendingSignups.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 px-5 py-3.5 transition-colors hover:bg-amber-50/40 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{p.username}</p>
                        <p className="text-xs text-gray-400">{p.email}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-semibold capitalize text-gray-500">{p.role}</span>
                        <span className="text-gray-400">{p.created_at ? new Date(p.created_at).toLocaleString() : "—"}</span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-bold text-amber-600">Pending</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── Footer ── */}
          <footer className="flex flex-col items-center justify-between gap-4 border-t border-gray-100 pt-8 sm:flex-row">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm"
                style={{ background: "linear-gradient(135deg,#0d9488,#059669)" }}>
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9.5L9 3.5L15 9.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 13.5L9 7.5L15 13.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.45"/>
                </svg>
              </span>
              <span className="text-sm font-extrabold text-gray-700" style={{ letterSpacing: "-0.02em" }}>
                earn<span className="text-teal-600">ytics</span>
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400">
              <span>&copy; {new Date().getFullYear()} Earnytics</span>
              <Link href="/terms" className="hover:text-gray-600 hover:underline">Terms &amp; Conditions</Link>
              <Link href="/privacy" className="hover:text-gray-600 hover:underline">Privacy Policy</Link>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
