"use client";
import { useEffect, useState } from "react";

type App = { id: number; publisher_id: string; campaign_id: string; status: string; applied_at: string };

export default function AdmitadApplicationsContent() {
  const [apps,        setApps]        = useState<App[]>([]);
  const [status,      setStatus]      = useState("pending");
  const [loading,     setLoading]     = useState(true);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [msg,         setMsg]         = useState<string | null>(null);

  const load = async (s = status) => {
    setLoading(true);
    const res = await fetch(`/api/admin/admitad/applications?status=${s}`, { credentials: "include" });
    if (res.ok) setApps((await res.json()).data ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const update = async (id: number, newStatus: string) => {
    await fetch("/api/admin/admitad/applications", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) });
    void load();
  };

  const approveAll = async () => {
    if (!apps.length) return;
    setBulkLoading(true); setMsg(null);
    const pending = apps.filter(a => a.status !== "approved");
    await Promise.all(
      pending.map(a =>
        fetch("/api/admin/admitad/applications", {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: a.id, status: "approved" }),
        })
      )
    );
    setMsg(`✓ ${pending.length} applications approved`);
    setBulkLoading(false);
    void load();
  };

  const pendingCount = apps.filter(a => a.status !== "approved").length;

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Admitad</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Applications</h1>
        </div>
        {status === "pending" && pendingCount > 0 && (
          <button onClick={() => void approveAll()} disabled={bulkLoading}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 shrink-0"
            style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}>
            {bulkLoading ? "Approving…" : `Approve all (${pendingCount})`}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {["pending","approved","rejected"].map(s => (
          <button key={s} onClick={() => { setStatus(s); void load(s); setMsg(null); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${status === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{msg}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
            <tr>{["Publisher","Campaign","Status","Applied","Actions"].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? <tr><td colSpan={5} className="py-8 text-center text-gray-400">Loading…</td></tr>
            : apps.length === 0 ? <tr><td colSpan={5} className="py-8 text-center text-gray-400">No applications</td></tr>
            : apps.map(a => (
              <tr key={a.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.publisher_id.slice(0,8)}…</td>
                <td className="px-4 py-3 text-gray-900">{a.campaign_id}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.status === "approved" ? "bg-emerald-100 text-emerald-700" : a.status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>{a.status}</span></td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(a.applied_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 flex gap-2">
                  {a.status !== "approved" && <button onClick={() => void update(a.id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Approve</button>}
                  {a.status !== "rejected" && <button onClick={() => void update(a.id, "rejected")} className="rounded-lg bg-red-500    px-3 py-1 text-xs font-semibold text-white">Reject</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
