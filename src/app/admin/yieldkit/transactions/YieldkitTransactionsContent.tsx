"use client";

import { useEffect, useState, useRef } from "react";

type Txn = {
  yk_id: string; advertiser_id: string | null; advertiser_name: string | null;
  commission: number; amount: number; currency: string; state: string;
  transaction_date: string | null; yk_tag: string | null; order_id: string | null;
  commission_type: string | null; publisher_id: string | null; synced_at: string;
};

const STATE_COLORS: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  OPEN:      "bg-blue-50 text-blue-700",
  PAID:      "bg-teal-50 text-teal-700",
  REJECTED:  "bg-red-50 text-red-600",
  DELAYED:   "bg-amber-50 text-amber-700",
};

function fmt(n: number, cur: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(n); }
  catch { return `${n.toFixed(2)} ${cur}`; }
}

export default function YieldkitTransactionsContent() {
  const [txns,    setTxns]    = useState<Txn[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [state,   setState]   = useState("");
  const debounce  = useRef<ReturnType<typeof setTimeout>>();

  const load = async (p = page, q = search, s = state) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (q) params.set("q", q);
    if (s) params.set("state", s);
    const res = await fetch(`/api/admin/yieldkit/transactions?${params}`, { credentials: "include" });
    if (res.ok) { const d = await res.json(); setTxns(d.transactions); setTotal(d.total); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleSearch = (v: string) => {
    setSearch(v); setPage(1);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { void load(1, v, state); }, 400);
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Yieldkit</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Transactions</h1>
        <p className="mt-1 text-sm text-gray-500">{total.toLocaleString()} commissions synced from Yieldkit.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="text" placeholder="Search advertiser, tag…" value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-64"
        />
        <select
          value={state} onChange={(e) => { setState(e.target.value); setPage(1); void load(1, search, e.target.value); }}
          className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-indigo-400">
          <option value="">All states</option>
          {["CONFIRMED", "OPEN", "PAID", "REJECTED", "DELAYED"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">Advertiser</th>
              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-gray-400">Commission</th>
              <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Amount</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400 hidden md:table-cell">Tag / Slug</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400">State</th>
              <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-gray-400 hidden lg:table-cell">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No transactions found. Run sync first.</td></tr>
            ) : txns.map((t) => (
              <tr key={t.yk_id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900 leading-tight">{t.advertiser_name ?? t.advertiser_id ?? "—"}</p>
                  <p className="text-[11px] font-mono text-gray-400">{t.yk_id}</p>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                  {fmt(Number(t.commission), t.currency)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 hidden sm:table-cell">
                  {fmt(Number(t.amount), t.currency)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden md:table-cell">
                  {t.yk_tag ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATE_COLORS[t.state] ?? "bg-gray-100 text-gray-500"}`}>
                    {t.state}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                  {t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : "—"}
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
