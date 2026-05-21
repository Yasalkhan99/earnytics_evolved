"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Brand = {
  campaignId: string;
  name: string;
  advertiserName: string | null;
  advertiserUrl: string | null;
  displayUrl: string | null;
  logoUrl: string | null;
  description: string | null;
  contractStatus: string | null;
  currency: string | null;
  allowsDeeplinking: boolean;
  applicationStatus: "not_applied" | "pending" | "approved" | "rejected";
  // Extra fields
  commissionLabel?: string | null;
  commissionType?: string | null;
  locale?: string | null;
  categoryName?: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  rangeFrom: number;
  rangeTo: number;
};

const LIMIT_OPTIONS = [12, 24, 36] as const;

const LOCALE_FLAG: Record<string, string> = {
  NL: "🇳🇱", FR: "🇫🇷", GB: "🇬🇧", UK: "🇬🇧", DE: "🇩🇪", BE: "🇧🇪",
  US: "🇺🇸", IT: "🇮🇹", ES: "🇪🇸", PL: "🇵🇱", SE: "🇸🇪", DK: "🇩🇰",
  NO: "🇳🇴", FI: "🇫🇮", AT: "🇦🇹", CH: "🇨🇭", AU: "🇦🇺", CA: "🇨🇦",
};
function localeFlag(locale?: string | null) {
  if (!locale) return null;
  return LOCALE_FLAG[locale.toUpperCase()] ?? locale.toUpperCase();
}

type Network = "impact" | "tradetracker" | "paidonresults" | "yieldkit";

export default function BrandsGridContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const approvedOnly = searchParams.get("filter") === "approved";
  const [network, setNetwork] = useState<Network>("impact");

  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [totalCampaigns, setTotalCampaigns] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  // Bulk select state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ done: number; failed: number; inserted?: number } | null>(null);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(12);
  const [searchDraft, setSearchDraft] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const firstLoad = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchDraft.trim()), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setBulkResult(null);
  }, [debouncedSearch, approvedOnly, limit]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  useEffect(() => {
    const ctrl = new AbortController();
    const load = async () => {
      const isFirst = firstLoad.current;
      if (isFirst) setLoading(true);
      else setRefetching(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (debouncedSearch) params.set("q", debouncedSearch);
      // TradeTracker always scoped to approved — publisher sees only their approved campaigns
      params.set("scope", (approvedOnly || network === "tradetracker") ? "approved" : "all");

      try {
        const apiBase = network === "tradetracker" ? "/api/publisher/tradetracker/brands"
                      : network === "paidonresults" ? "/api/publisher/por/brands"
                      : network === "yieldkit"      ? "/api/publisher/yieldkit/brands"
                      : "/api/publisher/impact/brands";
        const res = await fetch(`${apiBase}?${params.toString()}`, {
          credentials: "include",
          signal: ctrl.signal,
        });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Access denied.");
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Could not load brands.");
          return;
        }
        const data = await res.json();
        setBrands(data.brands ?? []);
        setPagination(data.pagination ?? null);
        setTotalCampaigns(data.totalCampaigns ?? 0);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError("Could not load brands.");
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setRefetching(false);
          firstLoad.current = false;
        }
      }
    };
    load();
    return () => ctrl.abort();
  }, [router, page, limit, debouncedSearch, approvedOnly, network]);

  const apply = async (campaignId: string) => {
    setApplyingId(campaignId);
    setError(null);
    try {
      const applyApi = network === "tradetracker" ? "/api/publisher/tradetracker/apply"
                     : network === "paidonresults" ? "/api/publisher/por/apply"
                     : network === "yieldkit"      ? "/api/publisher/yieldkit/apply"
                     : "/api/publisher/impact/apply";
      const res = await fetch(applyApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Apply failed.");
        return;
      }
      setBrands((prev) =>
        prev.map((b) =>
          b.campaignId === campaignId ? { ...b, applicationStatus: "pending" as const } : b
        )
      );
    } finally {
      setApplyingId(null);
    }
  };

  // Brands on current page that can still be applied to
  const applyableBrands = brands.filter(
    (b) => b.applicationStatus === "not_applied" || b.applicationStatus === "rejected"
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(applyableBrands.map((b) => b.campaignId)));
  const clearAll = () => setSelected(new Set());

  const bulkApply = async () => {
    if (selected.size === 0) return;
    setBulkApplying(true);
    setBulkResult(null);
    setError(null);

    const campaignIds = [...selected];
    try {
      const bulkApi = network === "tradetracker"   ? "/api/publisher/tradetracker/bulk-apply"
                   : network === "paidonresults" ? "/api/publisher/por/apply"
                   : network === "yieldkit"      ? "/api/publisher/yieldkit/apply"
                   : "/api/publisher/impact/bulk-apply";
      const res = await fetch(bulkApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignIds }),
      });
      const data = await res.json().catch(() => ({})) as { inserted?: number; alreadyApplied?: number; failed?: number; error?: string };
      if (!res.ok) {
        setError(data.error || "Bulk apply failed.");
      } else {
        const inserted = data.inserted ?? 0;
        const done = inserted + (data.alreadyApplied ?? 0);
        const failed = data.failed ?? 0;
        setBulkResult({ done, failed, inserted });
        // Mark all selected as pending in UI
        setBrands((prev) =>
          prev.map((b) => campaignIds.includes(b.campaignId) ? { ...b, applicationStatus: "pending" as const } : b)
        );
      }
    } catch {
      setError("Network error during bulk apply.");
    }

    setSelected(new Set());
    setBulkApplying(false);
  };

  const pg = pagination;
  const showFullSpinner = loading && brands.length === 0;

  if (showFullSpinner) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
        <p className="text-sm text-gray-400">Loading brands…</p>
      </div>
    );
  }

  const emptyNoCache = !loading && totalCampaigns === 0;
  const emptyApprovedTab = approvedOnly && pg && pg.total === 0 && totalCampaigns > 0 && !debouncedSearch;
  const emptySearch = pg && pg.total === 0 && debouncedSearch.length > 0;

  return (
    <div className="min-h-screen">
      {/* ── Gradient hero header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 px-4 pb-8 pt-8 sm:px-6">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-1/3 h-48 w-48 rounded-full bg-emerald-400/10 blur-2xl" />

        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-200/80">Brands</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {approvedOnly ? "My brands" : "Available brands"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-teal-100/80">
            {(approvedOnly || network === "tradetracker")
              ? `Campaigns your admin has approved for you${network === "tradetracker" ? " on TradeTracker" : ""}. Open a card for details.`
              : `All available ${network === "paidonresults" ? "PaidOnResults" : network === "yieldkit" ? "Yieldkit" : "Impact"} campaigns. Apply here for Earnytics approval to promote them.`}
          </p>

          {/* Network selector */}
          <div className="mt-5 inline-flex flex-wrap rounded-2xl bg-white/10 p-1 backdrop-blur-sm gap-1">
            {(["impact", "tradetracker", "paidonresults", "yieldkit"] as Network[]).map((n) => (
              <button key={n} onClick={() => { setNetwork(n); setPage(1); setBrands([]); }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${network === n ? "bg-white text-teal-700 shadow-md" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
                {n === "impact" ? "Impact" : n === "tradetracker" ? "TradeTracker" : n === "paidonresults" ? "PaidOnResults" : "Yieldkit"}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="mt-3 inline-flex rounded-2xl bg-white/10 p-1 backdrop-blur-sm" role="tablist">
            <Link href="/dashboard/brands" role="tab" aria-selected={!approvedOnly}
              className={`rounded-xl px-6 py-2 text-sm font-semibold transition-all ${
                !approvedOnly
                  ? "bg-white text-teal-700 shadow-md"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}>
              All brands
            </Link>
            <Link href="/dashboard/brands?filter=approved" role="tab" aria-selected={approvedOnly}
              className={`rounded-xl px-6 py-2 text-sm font-semibold transition-all ${
                approvedOnly
                  ? "bg-white text-teal-700 shadow-md"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}>
              My brands
            </Link>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Search + per-page bar */}
        <div className="mt-6 mb-6 flex items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search brands by name, URL or ID…"
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              aria-label="Search brands"
              autoComplete="off"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <label htmlFor="brands-page-size" className="text-xs font-medium text-gray-500">Per page</label>
            <select id="brands-page-size" value={limit} onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-lg bg-gray-50 px-2 py-1 text-sm font-medium text-gray-700 outline-none">
              {LIMIT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Bulk action bar */}
        {!approvedOnly && applyableBrands.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50 px-5 py-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-teal-800">
              <input
                type="checkbox"
                checked={selected.size === applyableBrands.length && applyableBrands.length > 0}
                onChange={() => selected.size === applyableBrands.length ? clearAll() : selectAll()}
                className="h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
              />
              {selected.size > 0 ? `${selected.size} selected` : `Select all (${applyableBrands.length})`}
            </label>
            {selected.size > 0 && (
              <>
                <button type="button" onClick={clearAll} className="text-xs text-teal-500 hover:text-teal-700">Clear</button>
                <button type="button" onClick={bulkApply} disabled={bulkApplying}
                  className="ml-auto rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60">
                  {bulkApplying ? `Applying… (${selected.size})` : `Apply for ${selected.size} campaign${selected.size > 1 ? "s" : ""}`}
                </button>
              </>
            )}
          </div>
        )}

        {bulkResult && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${bulkResult.failed === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
            {(bulkResult.inserted ?? bulkResult.done) > 0 && `✓ Applied to ${bulkResult.inserted ?? bulkResult.done} campaign${(bulkResult.inserted ?? bulkResult.done) > 1 ? "s" : ""}.`}
            {(bulkResult.done - (bulkResult.inserted ?? bulkResult.done)) > 0 && ` ${bulkResult.done - (bulkResult.inserted ?? 0)} already applied (skipped).`}
            {bulkResult.failed > 0 && ` ${bulkResult.failed} failed.`}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!error && emptyNoCache ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50">
              <svg className="h-8 w-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-700">No campaigns found</p>
            <p className="mt-1 text-sm text-gray-400">Ask an admin to sync {network === "tradetracker" ? "TradeTracker" : network === "paidonresults" ? "PaidOnResults" : "Impact"} campaigns.</p>
          </div>
        ) : !error && emptyApprovedTab ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
              <svg className="h-8 w-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-semibold text-gray-700">No approved brands yet</p>
            <p className="mt-1 text-sm text-gray-400">Apply from Available brands or wait for admin approval.</p>
          </div>
        ) : !error && emptySearch ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="font-semibold text-gray-700">No results for &ldquo;{debouncedSearch}&rdquo;</p>
            <p className="mt-1 text-sm text-gray-400">Try another name, URL, or ID.</p>
          </div>
        ) : (
          <>
            <div className={`${refetching ? "opacity-50 transition-opacity" : ""}`} aria-busy={refetching}>
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {brands.map((b) => {
                  const isSelected = selected.has(b.campaignId);
                  return (
                    <li key={b.campaignId}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                        isSelected
                          ? "ring-2 ring-teal-500 ring-offset-2"
                          : "border border-gray-100 hover:border-transparent"
                      }`}>
                      {/* top accent strip */}
                      <div className={`h-1 w-full ${
                        b.applicationStatus === "approved"
                          ? "bg-gradient-to-r from-teal-400 to-emerald-500"
                          : b.applicationStatus === "pending"
                          ? "bg-gradient-to-r from-amber-400 to-orange-400"
                          : "bg-gradient-to-r from-slate-200 to-slate-300 group-hover:from-teal-300 group-hover:to-emerald-400 transition-all duration-300"
                      }`} />

                      <div className="flex flex-col flex-1 p-5">
                        {/* logo + title row */}
                        <div className="flex gap-3">
                          <div className="relative h-14 w-14 shrink-0">
                            <div className="h-14 w-14 overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-gray-100 shadow-sm">
                              {b.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={b.logoUrl} alt="" className="h-full w-full object-contain p-1.5"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-600 text-xl font-bold text-white">
                                  {b.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1">
                              <h2 className="truncate text-sm font-bold text-gray-900 leading-snug">{b.name}</h2>
                              {b.contractStatus && (
                                <span className={`ml-1 mt-0.5 flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  b.contractStatus === "Active"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${b.contractStatus === "Active" ? "bg-emerald-500" : "bg-gray-400"}`} />
                                  {b.contractStatus}
                                </span>
                              )}
                            </div>
                            {b.advertiserName && b.advertiserName !== b.name && (
                              <p className="mt-0.5 truncate text-xs text-gray-400">{b.advertiserName}</p>
                            )}
                            {(b.advertiserUrl ?? b.displayUrl) && (
                              <a href={(b.advertiserUrl ?? b.displayUrl ?? "").startsWith("http")
                                  ? (b.advertiserUrl ?? b.displayUrl ?? "")
                                  : `https://${b.advertiserUrl ?? b.displayUrl}`}
                                target="_blank" rel="noopener noreferrer"
                                className="mt-0.5 block truncate text-[11px] text-teal-600 hover:text-teal-700 hover:underline">
                                {(b.advertiserUrl ?? b.displayUrl ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "")}
                              </a>
                            )}
                            {b.currency && (
                              <span className="mt-1 inline-block rounded-md bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                {b.currency}
                              </span>
                            )}
                          </div>
                        </div>

                        {b.description && (
                          <p className="mt-3 text-xs leading-relaxed text-gray-500 line-clamp-2">{b.description}</p>
                        )}

                        {/* Commission + Region + Category chips */}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {b.commissionLabel && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {b.commissionLabel}
                            </span>
                          )}
                          {b.locale && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100">
                              <span>{localeFlag(b.locale)}</span>
                              {b.locale.toUpperCase()}
                            </span>
                          )}
                          {b.categoryName && (
                            <span className="inline-flex items-center rounded-lg bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-100 truncate max-w-[120px]">
                              {b.categoryName}
                            </span>
                          )}
                          {b.allowsDeeplinking && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-[11px] font-semibold text-purple-700 ring-1 ring-purple-100">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                              </svg>
                              Deep link
                            </span>
                          )}
                        </div>

                        <div className="mt-auto pt-4">
                          {b.applicationStatus === "approved" && (
                            <Link href={network === "tradetracker" ? `/dashboard/brands/tradetracker/${b.campaignId}` : network === "paidonresults" ? `/dashboard/brands/por/${b.campaignId}` : network === "yieldkit" ? `/dashboard/brands/yieldkit/${b.campaignId}` : `/dashboard/brands/impact/${b.campaignId}`}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-200 transition hover:from-teal-600 hover:to-emerald-700 hover:shadow-teal-300">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                              View details
                            </Link>
                          )}
                          {b.applicationStatus === "pending" && (
                            <span className="flex w-full cursor-default items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-700">
                              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Pending review
                            </span>
                          )}
                          {(b.applicationStatus === "not_applied" || b.applicationStatus === "rejected") && (
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={isSelected}
                                onChange={() => toggleSelect(b.campaignId)}
                                className="h-4 w-4 shrink-0 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                aria-label={`Select ${b.name}`} />
                              <button type="button" onClick={() => apply(b.campaignId)}
                                disabled={applyingId === b.campaignId || bulkApplying || refetching}
                                className="flex-1 rounded-xl border-2 border-teal-600 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-600 hover:text-white disabled:opacity-60">
                                {b.applicationStatus === "rejected"
                                  ? applyingId === b.campaignId ? "Submitting…" : "Apply again"
                                  : applyingId === b.campaignId ? "Submitting…" : "Apply for approval"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {pg && pg.total > 0 && (
              <nav className="mt-10 flex flex-col items-center gap-4 border-t border-gray-100 pt-8 sm:flex-row sm:justify-between" aria-label="Pagination">
                <p className="text-sm text-gray-500">
                  Showing <span className="font-semibold text-gray-800">{pg.rangeFrom}–{pg.rangeTo}</span> of{" "}
                  <span className="font-semibold text-gray-800">{pg.total}</span>
                  {approvedOnly ? " approved campaigns" : " campaigns"}
                  {totalCampaigns > 0 && !approvedOnly && (
                    <span className="text-gray-400"> · {totalCampaigns.toLocaleString()} total on {network === "tradetracker" ? "TradeTracker" : network === "paidonresults" ? "PaidOnResults" : "Impact"}</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pg.page <= 1 || refetching}
                    className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    Prev
                  </button>
                  <span className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white shadow-sm">
                    {pg.page} / {pg.totalPages}
                  </span>
                  <button type="button" onClick={() => setPage((p) => Math.min(pg.totalPages, p + 1))}
                    disabled={pg.page >= pg.totalPages || refetching}
                    className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40">
                    Next
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </nav>
            )}
          </>
        )}

        <div className="pb-16" />
      </div>
    </div>
  );
}
