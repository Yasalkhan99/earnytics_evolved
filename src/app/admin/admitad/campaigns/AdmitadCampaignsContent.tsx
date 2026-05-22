"use client";
import { useEffect, useState } from "react";

type Campaign = { campaign_id: string; name: string; site_url: string; logo_url: string; status: string; currency: string; commission_type: string; commission_rate: string; regions: string[]; allow_deeplink: boolean };

export default function AdmitadCampaignsContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);

  const load = async (p = 1, q = search) => {
    setLoading(true);
    const res = await fetch(`/api/admin/admitad/campaigns?page=${p}&limit=50&search=${encodeURIComponent(q)}`, { credentials: "include" });
    if (res.ok) { const d = await res.json(); setCampaigns(d.data ?? []); setTotal(d.total ?? 0); setPage(p); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Admitad</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Campaigns</h1>
        <p className="mt-1 text-sm text-gray-500">Total in DB: {total.toLocaleString()}</p>
      </div>

      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && void load(1, search)}
          placeholder="Search campaigns…"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button onClick={() => void load(1, search)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Search</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
            <tr>{["Campaign","URL","Status","Commission","Regions","Deeplink"].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No campaigns found</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.campaign_id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {c.logo_url && <img src={c.logo_url} alt="" className="h-6 w-6 rounded object-contain" />}
                    <div><p className="font-medium text-gray-900">{c.name}</p><p className="text-[11px] text-gray-400">ID: {c.campaign_id}</p></div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{c.site_url}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-gray-700">{c.commission_rate ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{(c.regions ?? []).slice(0,4).join(", ")}{(c.regions?.length ?? 0) > 4 ? "…" : ""}</td>
                <td className="px-4 py-3">{c.allow_deeplink ? <span className="text-emerald-600 font-semibold text-xs">Yes</span> : <span className="text-gray-400 text-xs">No</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <button onClick={() => void load(page - 1)} disabled={page <= 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button>
        <span className="text-sm text-gray-500">Page {page}</span>
        <button onClick={() => void load(page + 1)} disabled={campaigns.length < 50} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
