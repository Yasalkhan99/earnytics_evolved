"use client";
import { useEffect, useState } from "react";

type Status = { configured: boolean; apiKey: string; baseUrl: string } | null;

export default function LinkhexaConnectionContent() {
  const [status,  setStatus]  = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/linkhexa/connection", { credentials: "include" })
      .then(r => r.json()).then(d => { setStatus(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const testConnection = async () => {
    setTesting(true); setTestMsg(null);
    const res  = await fetch("/api/admin/linkhexa/connection", { method: "POST", credentials: "include" });
    const data = await res.json();
    setTestMsg(res.ok
      ? `✓ Connected — ${data.programmeCount ?? 0} programmes in catalogue`
      : `✗ ${data.error ?? "Connection failed"}`);
    setTesting(false);
  };

  const Row = ({ label, value, ok }: { label: string; value: string; ok: boolean }) => (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${ok ? "text-emerald-600" : "text-red-500"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-400"}`} />
        {ok ? value : "✗ missing"}
      </span>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Linkhexa</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">API Connection</h1>
        <p className="mt-1 text-sm text-gray-500">Partner API at linkhexa.com/api/v1 (Bearer lh_live_…).</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Credentials status</p>
        {loading ? <p className="text-sm text-gray-400">Checking…</p> : (
          <>
            <Row label="LINKHEXA_API_KEY"      value="●●●● set" ok={status?.apiKey === "set"} />
            <Row label="LINKHEXA_API_BASE_URL" value={status?.baseUrl || "missing"} ok={!!status?.baseUrl} />
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Test connection</p>
        <p className="mb-4 text-sm text-gray-500">Fetches programme count from Linkhexa Partner API.</p>
        <button onClick={() => void testConnection()} disabled={testing || loading}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)" }}>
          {testing ? "Testing…" : "Test connection"}
        </button>
        {testMsg && (
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
            testMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}>{testMsg}</div>
        )}
      </div>

      <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5">
        <p className="text-xs font-black uppercase tracking-widest text-teal-600 mb-3">Required .env.local variables</p>
        <div className="space-y-1 font-mono text-xs bg-gray-900 text-green-400 rounded-xl p-4">
          <p>LINKHEXA_API_KEY=lh_live_…</p>
          <p>LINKHEXA_API_BASE_URL=https://www.linkhexa.com</p>
        </div>
      </div>
    </div>
  );
}
