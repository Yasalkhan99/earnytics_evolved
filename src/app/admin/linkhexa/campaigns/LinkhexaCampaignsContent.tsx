"use client";
import { useEffect, useState } from "react";

type Programme = {
  programme_id: string; name: string; display_url: string | null;
  logo_url: string | null; programme_status: string; currency_code: string | null;
  primary_region: string | null;
};

export default function LinkhexaCampaignsContent() {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);

  const load = async (p = 1, q = search) => {
    setLoading(true);
    const res = await fetch(`/api/admin/linkhexa/campaigns?page=${p}&limit=50&q=${encodeURIComponent(q)}`, { credentials: "include" });
    if (res.ok) {
      const d = await res.json();
      setProgrammes(d.data ?? []);
      setTotal(d.pagination?.total ?? 0);
      setPage(p);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Linkhexa</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Programmes</h1>
        <p className="mt-1 text-sm text-gray-500">Total in DB: {total.toLocaleString()}</p>
      </div>

      <div className="flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && void load(1, search)}
          placeholder="Search programmes…"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
        <button onClick={() => void load(1, search)} className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white">Search</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
            <tr>{["Programme","URL","Status","Currency","Region"].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : programmes.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-400">No programmes found — run Sync Programmes</td></tr>
            ) : programmes.map(c => (
              <tr key={c.programme_id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{c.display_url ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{c.programme_status}</span></td>
                <td className="px-4 py-3 text-gray-600">{c.currency_code ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{c.primary_region ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button onClick={() => void load(page - 1)} disabled={page <= 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Prev</button>
        <span className="flex items-center text-sm text-gray-500">Page {page}</span>
        <button onClick={() => void load(page + 1)} disabled={programmes.length < 50} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
