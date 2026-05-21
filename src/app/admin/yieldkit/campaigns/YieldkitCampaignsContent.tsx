"use client";

import { useEffect, useState, useRef } from "react";

type Campaign = {
  advertiser_id: string; name: string; url: string | null;
  logo_url: string | null; country: string | null; status: string;
  commission_type: string | null; commission_rate: string | null; fetched_at: string | null;
};

export default function YieldkitCampaignsContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [status,    setStatus]    = useState("");
  const debounce    = useRef<ReturnType<typeof setTimeout>>();

  const load = async (p = page, q = search, s = status) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (q) params.set("q", q);
    if (s) params.set("status", s);
    const res = await fetch(`/api/admin/yieldkit/campaigns?${params}`, { credentials: "include" });
    if (res.ok) { const d = await res.json(); setCampaigns(d.campaigns); setTotal(d.total); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleSearch = (v: string) => {
    setSearch(v); setPage(1);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { void load(1, v, status); }, 400);
  };

  const handleStatus = (v: string) => {
    setStatus(v); setPage(1); void load(1, search, v);
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Yieldkit</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Campaigns</h1>
        <p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} campaigns cached from Yieldkit.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text" placeholder="Search campaigns…" value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-64"
        />
        <select
          value={status} onChange={(e) => handleStatus(e.target.value)}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-indigo-400">
          <option value="">All statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">Campaign</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400 hidden md:table-cell">Country</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Commission</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No campaigns found. Sync first.</td></tr>
            ) : campaigns.map((c) => (
              <tr key={c.advertiser_id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="h-7 w-7 rounded object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-500">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900 leading-tight">{c.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{c.advertiser_id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{c.country ?? "—"}</td>
                <td className="px-4 py-3 text-gray-700 hidden sm:table-cell">{c.commission_rate ?? c.commission_type ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                    c.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {c.status}
                  </span>
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
