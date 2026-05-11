import type { SupabaseClient } from "@supabase/supabase-js";

const FRANKFURTER = "https://api.frankfurter.app";
const TO_CHUNK = 18;

export function txnIsoToUtcYmd(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return new Date().toISOString().slice(0, 10);
  return t.toISOString().slice(0, 10);
}

export function normalizeFxCurrency(c: string | null | undefined): string {
  return (c ?? "GBP").toUpperCase().trim() || "GBP";
}

/** `FX_USD_ENABLED=0` turns off USD approximation everywhere (sync + read-time). */
export function isFxUsdEnabled(): boolean {
  return process.env.FX_USD_ENABLED?.trim() !== "0";
}

type UpsertTxnLike = {
  commission_amount: number;
  commission_currency: string;
  sale_amount: number;
  sale_currency: string;
  transaction_date: string;
  commission_amount_usd?: number | null;
  sale_amount_usd?: number | null;
};

/**
 * Frankfurter: base USD → rates[CCY] is CCY per 1 USD → USD per 1 CCY = 1 / rates[CCY].
 * Fallback: `from=CCY&to=USD` with amount=1.
 */
async function fetchUsdPerUnitMapForDate(ymd: string, currencies: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  out.set("USD", 1);
  const need = [...new Set(currencies.map(normalizeFxCurrency))].filter((c) => c !== "USD");
  if (need.length === 0) return out;

  for (let i = 0; i < need.length; i += TO_CHUNK) {
    const chunk = need.slice(i, i + TO_CHUNK);
    const url = `${FRANKFURTER}/${encodeURIComponent(ymd)}?from=USD&to=${chunk.map(encodeURIComponent).join(",")}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const j = (await res.json()) as { rates?: Record<string, number> };
      const rates = j.rates ?? {};
      for (const c of chunk) {
        const r = rates[c];
        if (typeof r === "number" && r > 0) out.set(c, 1 / r);
      }
    } catch {
      /* ignore */
    }
  }

  for (const c of need) {
    if (out.has(c)) continue;
    const url = `${FRANKFURTER}/${encodeURIComponent(ymd)}?amount=1&from=${encodeURIComponent(c)}&to=USD`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const j = (await res.json()) as { rates?: { USD?: number } };
      const u = j.rates?.USD;
      if (typeof u === "number" && u > 0) out.set(c, u);
    } catch {
      /* ignore */
    }
  }

  return out;
}

function cacheKey(rateDate: string, currency: string): string {
  return `${rateDate}|${normalizeFxCurrency(currency)}`;
}

async function loadCachedRates(
  supabase: SupabaseClient,
  dates: string[],
  currencies: Set<string>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (dates.length === 0) return map;
  const ccys = [...currencies].filter((c) => normalizeFxCurrency(c) !== "USD");
  if (ccys.length === 0) {
    for (const d of dates) map.set(cacheKey(d, "USD"), 1);
    return map;
  }

  const uniqDates = [...new Set(dates)].sort();
  const { data, error } = await supabase
    .from("fx_daily_rates")
    .select("rate_date, currency, usd_per_unit")
    .in("rate_date", uniqDates)
    .in("currency", [...new Set(["USD", ...ccys])]);

  if (error) return map;
  for (const row of data ?? []) {
    const d = String((row as { rate_date?: string }).rate_date ?? "").slice(0, 10);
    const cur = normalizeFxCurrency((row as { currency?: string }).currency);
    const v = Number((row as { usd_per_unit?: number | string }).usd_per_unit ?? 0);
    if (d && cur && Number.isFinite(v) && v > 0) map.set(cacheKey(d, cur), v);
  }
  return map;
}

async function upsertRateRows(
  supabase: SupabaseClient,
  rateDate: string,
  usdPerUnit: Map<string, number>
): Promise<void> {
  const rows = [...usdPerUnit.entries()].map(([currency, usd_per_unit]) => ({
    rate_date: rateDate,
    currency: normalizeFxCurrency(currency),
    usd_per_unit,
    source: "frankfurter",
    fetched_at: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("fx_daily_rates").upsert(rows, { onConflict: "rate_date,currency" });
  void error;
}

/**
 * Fills `commission_amount_usd` / `sale_amount_usd` on each row using `fx_daily_rates` + Frankfurter for misses.
 * Uses transaction UTC calendar day. No-op when `FX_USD_ENABLED=0` or empty rows.
 * Safe on attributed read models: mutates rows in memory for API responses.
 */
export async function applyUsdToAwinUpsertRows(supabase: SupabaseClient, rows: UpsertTxnLike[]): Promise<void> {
  if (!isFxUsdEnabled() || rows.length === 0) {
    for (const r of rows) {
      r.commission_amount_usd = 0;
      r.sale_amount_usd = 0;
    }
    return;
  }

  const dates: string[] = [];
  const currencies = new Set<string>();
  for (const r of rows) {
    dates.push(txnIsoToUtcYmd(r.transaction_date));
    currencies.add(normalizeFxCurrency(r.commission_currency));
    currencies.add(normalizeFxCurrency(r.sale_currency));
  }

  const cache = await loadCachedRates(supabase, dates, currencies);

  const needByDate = new Map<string, Set<string>>();
  for (const r of rows) {
    const ymd = txnIsoToUtcYmd(r.transaction_date);
    for (const c of [normalizeFxCurrency(r.commission_currency), normalizeFxCurrency(r.sale_currency)]) {
      if (c === "USD") continue;
      if (!cache.has(cacheKey(ymd, c))) {
        const set = needByDate.get(ymd) ?? new Set<string>();
        set.add(c);
        needByDate.set(ymd, set);
      }
    }
  }

  for (const [ymd, set] of needByDate) {
    const missing = [...set].filter((c) => !cache.has(cacheKey(ymd, c)));
    if (missing.length === 0) continue;
    const fetched = await fetchUsdPerUnitMapForDate(ymd, missing);
    for (const [c, v] of fetched) {
      if (v > 0) cache.set(cacheKey(ymd, c), v);
    }
    await upsertRateRows(supabase, ymd, fetched);
  }

  for (const r of rows) {
    const ymd = txnIsoToUtcYmd(r.transaction_date);
    const cc = normalizeFxCurrency(r.commission_currency);
    const sc = normalizeFxCurrency(r.sale_currency);
    const uc = cc === "USD" ? 1 : cache.get(cacheKey(ymd, cc)) ?? 0;
    const us = sc === "USD" ? 1 : cache.get(cacheKey(ymd, sc)) ?? 0;
    const ca = Number(r.commission_amount ?? 0);
    const sa = Number(r.sale_amount ?? 0);
    r.commission_amount_usd = Number.isFinite(ca) && Number.isFinite(uc) ? Math.round(ca * uc * 1e6) / 1e6 : 0;
    r.sale_amount_usd = Number.isFinite(sa) && Number.isFinite(us) ? Math.round(sa * us * 1e6) / 1e6 : 0;
  }
}
