"use client";

import { useEffect, useState } from "react";

type Application = {
  id: string; publisher_id: string; advertiser_id: string;
  status: string; created_at: string; updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
};

export default function YieldkitApplicationsContent() {
  const [apps,    setApps]    = useState<Application[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async (p = page, s = filter) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (s) params.set("status", s);
    const res = await fetch(`/api/admin/yieldkit/applications?${params}`, { credentials: "include" });
    if (res.ok) { const d = await res.json(); setApps(d.applications); setTotal(d.total); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch("/api/admin/yieldkit/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
      credentials: "include",
    });
    setUpdating(null);
    await load();
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Yieldkit</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} publisher applications for Yieldkit campaigns.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "pending", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); void load(1, s); }}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === s ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            }`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">Publisher</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">Advertiser ID</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400 hidden md:table-cell">Applied</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : apps.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No applications found.</td></tr>
            ) : apps.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.publisher_id.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{a.advertiser_id}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-500"}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 hidden md:table-cell">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  {a.status === "pending" && (
                    <div className="flex gap-1.5">
                      <button disabled={updating === a.id} onClick={() => void updateStatus(a.id, "approved")}
                        className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                        Approve
                      </button>
                      <button disabled={updating === a.id} onClick={() => void updateStatus(a.id, "rejected")}
                        className="rounded-lg bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                  {a.status !== "pending" && (
                    <button disabled={updating === a.id} onClick={() => void updateStatus(a.id, "pending")}
                      className="rounded-lg bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                      Reset
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">Page {page} · {total.toLocaleString()} total</p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); void load(p); }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40">← Prev</button>
            <button disabled={page * 50 >= total} onClick={() => { const p = page + 1; setPage(p); void load(p); }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
