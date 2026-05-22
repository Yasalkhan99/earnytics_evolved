"use client";
import { useEffect, useState } from "react";

type Status = { configured: boolean; clientId: string; clientSecret: string; base64Header: string; publisherCode: string } | null;

export default function AdmitadConnectionContent() {
  const [status,  setStatus]  = useState<Status>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/admitad/connection", { credentials: "include" })
      .then(r => r.json()).then(d => { setStatus(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const testConnection = async () => {
    setTesting(true); setTestMsg(null);
    const res  = await fetch("/api/admin/admitad/connection", { method: "POST", credentials: "include" });
    const data = await res.json();
    setTestMsg(res.ok
      ? `✓ Connected — ${data.campaignCount ?? 0} campaigns available (publisher: ${data.publisherCode ?? ""})`
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
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Admitad</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">API Connection</h1>
        <p className="mt-1 text-sm text-gray-500">Verify your Admitad API credentials are configured correctly.</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Credentials status</p>
        {loading ? <p className="text-sm text-gray-400">Checking…</p> : (
          <>
            <Row label="ADMITAD_CLIENT_ID"      value="●●●● set" ok={status?.clientId     === "set"} />
            <Row label="ADMITAD_CLIENT_SECRET"  value="●●●● set" ok={status?.clientSecret === "set"} />
            <Row label="ADMITAD_BASE64_HEADER"  value="●●●● set" ok={status?.base64Header === "set"} />
            <Row label="ADMITAD_PUBLISHER_CODE" value={status?.publisherCode || "missing"} ok={!!(status?.publisherCode)} />
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Test connection</p>
        <p className="mb-4 text-sm text-gray-500">Fetches campaign count from Admitad API using your credentials.</p>
        <button onClick={() => void testConnection()} disabled={testing || loading}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          {testing ? "Testing…" : "Test connection"}
        </button>
        {testMsg && (
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
            testMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}>{testMsg}</div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3">Required .env.local variables</p>
        <div className="space-y-1 font-mono text-xs bg-gray-900 text-green-400 rounded-xl p-4">
          <p>ADMITAD_CLIENT_ID=<span className="text-gray-400"># from your Admitad account API settings</span></p>
          <p>ADMITAD_CLIENT_SECRET=<span className="text-gray-400"># from your Admitad account API settings</span></p>
          <p>ADMITAD_BASE64_HEADER=<span className="text-gray-400"># base64(client_id:client_secret)</span></p>
          <p>ADMITAD_PUBLISHER_CODE=<span className="text-gray-400"># your webmaster code (auto-detected on connect)</span></p>
        </div>
      </div>
    </div>
  );
}
