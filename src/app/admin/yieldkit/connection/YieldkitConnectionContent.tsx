"use client";

import { useEffect, useState } from "react";

type Status = {
  configured: boolean;
  apiKey: string;
  apiSecret: string;
  siteId: string;
  domain: string;
} | null;

export default function YieldkitConnectionContent() {
  const [status,   setStatus]   = useState<Status>(null);
  const [loading,  setLoading]  = useState(true);
  const [testing,  setTesting]  = useState(false);
  const [testMsg,  setTestMsg]  = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/yieldkit/connection", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const testConnection = async () => {
    setTesting(true); setTestMsg(null);
    const res  = await fetch("/api/admin/yieldkit/connection", { method: "POST", credentials: "include" });
    const data = await res.json();
    setTestMsg(res.ok
      ? `✓ Connected — ${data.campaignCount ?? 0} campaigns found (site: ${data.siteId ?? ""})`
      : `✗ ${data.error ?? "Connection failed"}`);
    setTesting(false);
  };

  const Row = ({ label, value, ok, warn }: { label: string; value: string; ok: boolean; warn?: boolean }) => (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${ok ? (warn ? "text-amber-600" : "text-emerald-600") : "text-red-500"}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? (warn ? "bg-amber-400" : "bg-emerald-500") : "bg-red-400"}`} />
        {ok ? value : "✗ missing"}
      </span>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Admin · Yieldkit</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">API Connection</h1>
        <p className="mt-1 text-sm text-gray-500">Verify your Yieldkit API credentials are configured correctly.</p>
      </div>

      {/* Important notice */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
        <p className="text-sm font-bold text-amber-800">⚠ Domain approval required for campaigns</p>
        <p className="text-sm text-amber-700">
          The Yieldkit Advertiser API only returns campaigns for <strong>pre-approved domains</strong>.
          Your domain must be registered and approved by your Yieldkit Account Manager before campaign sync will work.
        </p>
        <p className="text-sm text-amber-700">
          Log into <a href="https://home.yieldkit.com/account" target="_blank" rel="noreferrer" className="underline font-semibold">home.yieldkit.com/account</a> to:
        </p>
        <ul className="list-disc list-inside text-sm text-amber-700 space-y-1 pl-1">
          <li>Find your registered domain (Your Sites tab) — set as <code className="rounded bg-amber-100 px-1 font-mono text-xs">YIELDKIT_DOMAIN</code></li>
          <li>Find your custom redirect domain — set as <code className="rounded bg-amber-100 px-1 font-mono text-xs">YIELDKIT_REDIRECT_DOMAIN</code></li>
          <li>Contact your AM to approve the domain for campaign access</li>
        </ul>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Credentials status</p>
        {loading ? (
          <p className="text-sm text-gray-400">Checking…</p>
        ) : (
          <>
            <Row label="YIELDKIT_API_KEY"          value="●●●● set" ok={status?.apiKey    === "set"} />
            <Row label="YIELDKIT_API_SECRET"       value="●●●● set" ok={status?.apiSecret === "set"} />
            <Row label="YIELDKIT_SITE_ID"          value="●●●● set" ok={status?.siteId    === "set"} />
            <Row label="YIELDKIT_DOMAIN"           value={status?.domain ?? ""} ok={!!(status?.domain)} warn={!!(status?.domain)} />
            <Row label="YIELDKIT_REDIRECT_DOMAIN"  value="(optional)" ok={true} warn={true} />
          </>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Test connection</p>
        <p className="mb-4 text-sm text-gray-500">
          Calls the Yieldkit Advertiser API. Will return 0 campaigns until your domain is approved by Yieldkit.
        </p>
        <button
          onClick={() => void testConnection()}
          disabled={testing || loading}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
          {testing ? "Testing…" : "Test connection"}
        </button>
        {testMsg && (
          <div className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
            testMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}>
            {testMsg}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
        <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3">Required .env.local variables</p>
        <div className="space-y-2 font-mono text-xs bg-gray-900 text-green-400 rounded-xl p-4">
          <p>YIELDKIT_API_KEY=<span className="text-gray-400"># from home.yieldkit.com/account → API tab</span></p>
          <p>YIELDKIT_API_SECRET=<span className="text-gray-400"># from home.yieldkit.com/account → API tab</span></p>
          <p>YIELDKIT_SITE_ID=<span className="text-gray-400"># from Your Sites tab</span></p>
          <p>YIELDKIT_DOMAIN=<span className="text-gray-400"># your registered domain e.g. example.com</span></p>
          <p>YIELDKIT_REDIRECT_DOMAIN=<span className="text-gray-400"># custom redirect domain e.g. r.example.com</span></p>
        </div>
      </div>
    </div>
  );
}
