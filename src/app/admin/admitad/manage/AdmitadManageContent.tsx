"use client";
import { useEffect, useState } from "react";

type Stats = {
  totalCampaigns: number; activeCampaigns: number; totalTransactions: number;
  pendingApplications: number; commissionByCurrency: Record<string, number>;
  lastSyncAt: string | null; lastSyncError: string | null;
};

function formatMoney(n: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
}

export default function AdmitadManageContent() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/admitad/stats", { credentials: "include" });
    if (res.ok) setStats(await res.json());
    setLoading(false);
  };

  useEffect(() => { void loadStats(); }, []);

  const runSync = async (action: string) => {
    setSyncing(action); setSyncMsg(null);
    const urlMap: Record<string, string> = {
      campaigns:    "/api/admin/admitad/sync-campaigns",
      transactions: "/api/admin/admitad/sync-transactions",
      rollup:       "/api/admin/admitad/rebuild-rollup",
    };
    const res  = await fetch(urlMap[action]!, { method: "POST", credentials: "include" });
    const data = await res.json();
    setSyncMsg(res.ok
      ? `✓ Done${data.upserted != null ? ` — ${data.upserted} records synced` : ""}`
      : `✗ ${data.error ?? "Failed"}`);
    setSyncing(null);
    await loadStats();
  };

  const kpis = [
    { label: "Total Campaigns",      value: stats?.totalCampaigns      ?? 0, icon: "🛒" },
    { label: "Active Campaigns",     value: stats?.activeCampaigns     ?? 0, icon: "✅" },
    { label: "Total Transactions",   value: stats?.totalTransactions   ?? 0, icon: "💳" },
    { label: "Pending Applications", value: stats?.pendingApplications ?? 0, icon: "⏳" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Admitad</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Sync &amp; Manage</h1>
        <p className="mt-1 text-sm text-gray-500">Sync campaigns and transactions from the Admitad API.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-lg">{k.icon}</p>
            <p className="mt-2 text-2xl font-extrabold tabular-nums text-gray-900">{loading ? "…" : k.value.toLocaleString()}</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
          </div>
        ))}
      </div>

      {stats && Object.keys(stats.commissionByCurrency).length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Confirmed Commissions</p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats.commissionByCurrency).map(([c, v]) => (
              <div key={c}><p className="text-xl font-extrabold text-indigo-600">{formatMoney(v, c)}</p><p className="text-[11px] text-gray-400">{c}</p></div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { id: "campaigns",    label: "Sync Campaigns",    desc: "Fetch all campaigns from Admitad API.", icon: "🛒" },
          { id: "transactions", label: "Sync Transactions", desc: "Fetch recent commissions (last 90 days).", icon: "💳" },
          { id: "rollup",       label: "Rebuild Rollup",    desc: "Rebuild publisher earnings daily summary.", icon: "📊" },
        ].map((a) => (
          <div key={a.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{a.icon}</span>
              <div><p className="font-bold text-gray-900">{a.label}</p><p className="mt-0.5 text-xs text-gray-500">{a.desc}</p></div>
            </div>
            <button onClick={() => void runSync(a.id)} disabled={syncing !== null}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
              {syncing === a.id ? "Syncing…" : a.label}
            </button>
          </div>
        ))}
      </div>

      {syncMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          syncMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
        }`}>{syncMsg}</div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-gray-400">Sync Status</p>
        <div className="space-y-2">
          <div className="flex items-baseline gap-3">
            <span className="min-w-[120px] text-sm text-gray-500">Last sync</span>
            <span className="text-sm text-gray-800">{stats?.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleString() : "Never"}</span>
          </div>
          {stats?.lastSyncError && (
            <div className="flex items-baseline gap-3">
              <span className="min-w-[120px] text-sm text-gray-500">Last error</span>
              <span className="text-sm text-red-600 break-all">{stats.lastSyncError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
