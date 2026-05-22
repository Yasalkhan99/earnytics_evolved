"use client";
import { useEffect, useState } from "react";

type Stats = {
  totalProgrammes: number; activeProgrammes: number; totalTransactions: number;
  pendingApplications: number; commissionByCurrency: Record<string, number>;
  lastSyncAt: string | null; lastSyncError: string | null;
};

export default function LinkhexaManageContent() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/linkhexa/stats", { credentials: "include" });
    if (res.ok) setStats(await res.json());
    setLoading(false);
  };

  useEffect(() => { void loadStats(); }, []);

  const runSync = async (action: string) => {
    setSyncing(action); setSyncMsg(null);
    const urlMap: Record<string, string> = {
      programmes:   "/api/admin/linkhexa/sync-campaigns",
      transactions: "/api/admin/linkhexa/sync-transactions",
      rollup:       "/api/admin/linkhexa/rebuild-rollup",
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
    { label: "Total Programmes",     value: stats?.totalProgrammes     ?? 0, icon: "🛒" },
    { label: "Active Programmes",    value: stats?.activeProgrammes    ?? 0, icon: "✅" },
    { label: "Total Transactions",   value: stats?.totalTransactions   ?? 0, icon: "💳" },
    { label: "Pending Applications", value: stats?.pendingApplications ?? 0, icon: "⏳" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Linkhexa</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Sync &amp; Manage</h1>
        <p className="mt-1 text-sm text-gray-500">Sync programmes and transactions from the Linkhexa Partner API.</p>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading stats…</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-2xl">{k.icon}</p>
              <p className="mt-2 text-2xl font-extrabold text-gray-900">{k.value.toLocaleString()}</p>
              <p className="text-xs font-medium text-gray-500">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { id: "programmes",   label: "Sync Programmes",   desc: "Fetch all brands from GET /api/v1/brands.", icon: "🛒" },
          { id: "transactions", label: "Sync Transactions", desc: "Last 90 days (31-day API windows).", icon: "💳" },
          { id: "rollup",       label: "Rebuild rollup",    desc: "Refresh daily earnings table.", icon: "📊" },
        ].map(s => (
          <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-2xl">{s.icon}</p>
            <p className="mt-2 font-bold text-gray-900">{s.label}</p>
            <p className="mt-1 text-xs text-gray-500">{s.desc}</p>
            <button onClick={() => void runSync(s.id)} disabled={syncing !== null}
              className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)" }}>
              {syncing === s.id ? "Running…" : s.label}
            </button>
          </div>
        ))}
      </div>

      {syncMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
          syncMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
        }`}>{syncMsg}</div>
      )}

      {stats?.lastSyncAt && (
        <p className="text-xs text-gray-400">Last sync: {new Date(stats.lastSyncAt).toLocaleString()}</p>
      )}
      {stats?.lastSyncError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">Last error: {stats.lastSyncError}</p>
      )}
    </div>
  );
}
