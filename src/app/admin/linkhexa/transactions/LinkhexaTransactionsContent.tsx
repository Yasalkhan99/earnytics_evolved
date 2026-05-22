"use client";
import { useEffect, useState } from "react";

type Txn = {
  linkhexa_txn_id: string; programme_name: string | null; status: string;
  commission_amount: number; currency: string; transaction_date: string | null; click_ref: string | null;
};

export default function LinkhexaTransactionsContent() {
  const [txns,    setTxns]    = useState<Txn[]>([]);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async (p = 1) => {
    setLoading(true);
    const res = await fetch(`/api/admin/linkhexa/transactions?page=${p}&limit=50`, { credentials: "include" });
    if (res.ok) { const d = await res.json(); setTxns(d.data ?? []); setPage(p); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Linkhexa</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Transactions</h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
            <tr>{["ID","Programme","Status","Commission","Date","Click ref"].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No transactions — run Sync Transactions</td></tr>
            ) : txns.map(t => (
              <tr key={t.linkhexa_txn_id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.linkhexa_txn_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{t.programme_name ?? "—"}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold">{t.status}</span></td>
                <td className="px-4 py-3">{t.currency} {Number(t.commission_amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{t.transaction_date ? new Date(t.transaction_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.click_ref ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <button onClick={() => void load(page - 1)} disabled={page <= 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Prev</button>
        <button onClick={() => void load(page + 1)} disabled={txns.length < 50} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
