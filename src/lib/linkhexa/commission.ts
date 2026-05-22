import type { LinkhexaBrandDetail, LinkhexaCommissionRange } from "./types";

/** Best-effort commission hint from programme description when API has no ranges. */
export function parseCommissionHintFromDescription(description: string | null): string | null {
  if (!description?.trim()) return null;
  const d = description;
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*commission/i,
    /commission[s]?\s+(?:of|from|starting\s+from|up\s+to|starting)?\s*(\d+(?:\.\d+)?)\s*%/i,
    /earn\s+(?:up\s+to\s+)?(\d+(?:\.\d+)?)\s*%/i,
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*%\s*commission/i,
  ];
  for (const re of patterns) {
    const m = d.match(re);
    if (!m) continue;
    if (m[2]) return `${m[1]}% – ${m[2]}%`;
    if (m[1]) return `${m[1]}%`;
  }
  if (/high commission|earn commission/i.test(d)) return "See advertiser terms";
  return null;
}

function formatOneRange(r: LinkhexaCommissionRange, currencyCode: string): string {
  const min = r.min ?? 0;
  const max = r.max ?? r.min ?? 0;
  const t = (r.type ?? "").toLowerCase();
  if (t === "percentage") {
    return min === max ? `${min}%` : `${min}% – ${max}%`;
  }
  const cur = currencyCode.trim() || "USD";
  try {
    const fmt = new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 2 });
    return min === max ? fmt.format(min) : `${fmt.format(min)} – ${fmt.format(max)}`;
  } catch {
    return min === max ? `${min} ${cur}` : `${min}–${max} ${cur}`;
  }
}

function formatRanges(ranges: LinkhexaCommissionRange[], currencyCode: string | null): string | null {
  if (!ranges.length) return null;
  const parts = ranges.map((r) => formatOneRange(r, currencyCode ?? "USD"));
  return parts.join(" · ");
}

/** Map Linkhexa brand detail API → DB commission columns. */
export function linkhexaDetailToCommissionCache(detail: LinkhexaBrandDetail) {
  const cur = detail.brand.currencyCode ?? "USD";
  const rangeSummary = formatRanges(detail.commission.ranges, cur);
  const summary = detail.commission.summary?.trim() || rangeSummary;
  const firstType = detail.commission.ranges[0]?.type?.toLowerCase();
  return {
    commission_summary:  summary,
    commission_type:     firstType === "percentage" ? "percentage" : firstType ? "fixed" : null,
    epc:                 detail.kpi.epcFormatted,
    conversion_rate:     detail.kpi.conversionRateDisplay,
    validation_days:     detail.kpi.validationDays,
    deeplink_enabled:    detail.kpi.deeplinkEnabled,
    commission_fetched_at: new Date().toISOString(),
  };
}

export const LINKHEXA_COMMISSION_CACHE_MS = 24 * 3600_000;

export function commissionFromProgrammeRow(row: {
  commission_summary?: string | null;
  commission_type?: string | null;
  epc?: string | null;
  conversion_rate?: string | null;
  validation_days?: number | null;
  deeplink_enabled?: boolean | null;
  description?: string | null;
}): {
  commissionSummary: string | null;
  commissionType: string | null;
  epc: string | null;
  conversionRate: string | null;
  validationDays: number | null;
  deeplinkEnabled: boolean | null;
  source: "linkhexa" | "description" | null;
} {
  if (row.commission_summary || row.epc || row.conversion_rate) {
    return {
      commissionSummary: row.commission_summary ?? null,
      commissionType:    row.commission_type ?? null,
      epc:               row.epc ?? null,
      conversionRate:    row.conversion_rate ?? null,
      validationDays:    row.validation_days ?? null,
      deeplinkEnabled:   row.deeplink_enabled ?? null,
      source: "linkhexa",
    };
  }
  const hint = parseCommissionHintFromDescription(row.description ?? null);
  if (hint) {
    return {
      commissionSummary: hint,
      commissionType:    hint.includes("%") ? "percentage" : null,
      epc: null, conversionRate: null, validationDays: null, deeplinkEnabled: null,
      source: "description",
    };
  }
  return {
    commissionSummary: null, commissionType: null, epc: null,
    conversionRate: null, validationDays: null, deeplinkEnabled: null, source: null,
  };
}
