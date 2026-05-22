"use client";
import { useEffect, useState } from "react";

type Txn = { admitad_id: string; campaign_name: string; status: string; payment: number; currency: string; creation_date: string; subid: string };

export default function AdmitadTransactionsContent() {
  const [txns,    setTxns]    = useState<Txn[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (p = 1, s = status) => {
    setLoading(true);
    const res = await fetch(`/api/admin/admitad/transactions?page=${p}&limit=50${s ? `&status=${s}` : ""}`, { credentials: "include" });
    if (res.ok) { const d = await res.json(); setTxns(d.data ?? []); setTotal(d.total ?? 0); setPage(p); }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const statusColor = (s: string) =>
    s === "approved" ? "bg-emerald-100 text-emerald-700" : s === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-5 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Admitad</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">Transactions</h1>
        <p className="mt-1 text-sm text-gray-500">Total: {total.toLocaleString()}</p>
      </div>

      <div className="flex gap-2">
        {["", "approved", "pending", "rejected"].map(s => (
          <button key={s} onClick={() => { setStatus(s); void load(1, s); }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${status === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-black uppercase tracking-wider text-gray-400">
            <tr>{["ID","Campaign","Status","Payment","Date","Sub ID"].map(h => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading…</td></tr>
            ) : txns.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-400">No transactions found</td></tr>
            ) : txns.map(t => (
              <tr key={t.admitad_id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.admitad_id}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{t.campaign_name ?? "—"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(t.status)}`}>{t.status}</span></td>
                <td className="px-4 py-3 font-semibold text-gray-900">{t.payment?.toFixed(2)} {t.currency}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{t.creation_date ? new Date(t.creation_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{t.subid ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <button onClick={() => void load(page - 1)} disabled={page <= 1} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Previous</button>
        <span className="text-sm text-gray-500">Page {page}</span>
        <button onClick={() => void load(page + 1)} disabled={txns.length < 50} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
