import type {
  LinkhexaBrandDetail,
  LinkhexaBrandKpi,
  LinkhexaCommissionRange,
  LinkhexaCreative,
  LinkhexaProgramme,
  LinkhexaTrackingLink,
  LinkhexaTransaction,
} from "./types";

function getApiKey(): string {
  return process.env.LINKHEXA_API_KEY ?? "";
}

function getBaseUrl(): string {
  const raw = process.env.LINKHEXA_API_BASE_URL ?? "https://www.linkhexa.com";
  return raw.replace(/\/$/, "");
}

const DEFAULT_TIMEOUT_MS = 12_000;

async function apiFetch(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const key = getApiKey();
  if (!key) throw new Error("LINKHEXA_API_KEY not configured");

  const url = `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: _t, ...rest } = init ?? {};

  const res = await fetch(url, {
    ...rest,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(rest.headers ?? {}),
    },
    cache: "no-store",
  });
  return res;
}

function mapProgramme(raw: Record<string, unknown>): LinkhexaProgramme {
  const region = raw.primaryRegion as { name?: string; countryCode?: string } | null | undefined;
  return {
    programmeId:     String(raw.programmeId ?? "").trim(),
    name:            String(raw.name ?? "").trim() || `Programme ${raw.programmeId ?? ""}`,
    description:     typeof raw.description === "string" ? raw.description : null,
    displayUrl:      typeof raw.displayUrl === "string" ? raw.displayUrl : null,
    logoUrl:         typeof raw.logoUrl === "string" ? raw.logoUrl : null,
    clickThroughUrl: typeof raw.clickThroughUrl === "string" ? raw.clickThroughUrl : null,
    currencyCode:    typeof raw.currencyCode === "string" ? raw.currencyCode : null,
    programmeStatus: typeof raw.programmeStatus === "string" ? raw.programmeStatus : "Active",
    primaryRegion:   region?.name ?? null,
    countryCode:     region?.countryCode ?? null,
    validDomains:    raw.validDomains ?? null,
  };
}

function mapTransaction(raw: Record<string, unknown>): LinkhexaTransaction | null {
  const id = String(
    raw.id ?? raw.transactionId ?? raw.transaction_id ?? raw.saleId ?? ""
  ).trim();
  if (!id) return null;

  const programmeId = raw.programmeId ?? raw.programme_id ?? raw.advertiserId;
  const sale = Number(raw.saleAmount ?? raw.amount ?? raw.orderAmount ?? raw.sale_amount ?? 0);
  const commission = Number(
    raw.commissionAmount ?? raw.commission ?? raw.payment ?? raw.commission_amount ?? 0
  );
  const dateRaw = raw.transactionDate ?? raw.transaction_date ?? raw.date ?? raw.saleDate;
  const clickRef = raw.clickRef ?? raw.clickref ?? raw.click_ref ?? raw.slug ?? raw.subid;

  return {
    linkhexaTxnId:     id,
    programmeId:       programmeId != null ? String(programmeId) : null,
    programmeName:     typeof raw.programmeName === "string" ? raw.programmeName
      : typeof raw.advertiserName === "string" ? raw.advertiserName : null,
    saleAmount:        Number.isFinite(sale) ? sale : 0,
    commissionAmount:  Number.isFinite(commission) ? commission : 0,
    currency:          typeof raw.currency === "string" ? raw.currency.toUpperCase()
      : typeof raw.currencyCode === "string" ? raw.currencyCode.toUpperCase() : "USD",
    transactionDate:   typeof dateRaw === "string" ? dateRaw : null,
    status:            typeof raw.status === "string" ? raw.status.toLowerCase()
      : typeof raw.commissionStatus === "string" ? raw.commissionStatus.toLowerCase() : "pending",
    clickRef:          clickRef != null ? String(clickRef).trim() || null : null,
  };
}

export async function fetchProgrammes(): Promise<LinkhexaProgramme[]> {
  const programmes: LinkhexaProgramme[] = [];
  const LIMIT = 100;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await apiFetch(`/api/v1/brands?page=${page}&limit=${LIMIT}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Linkhexa brands API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as {
      brands?: Record<string, unknown>[];
      pagination?: { totalPages?: number };
    };
    const items = data.brands ?? [];
    if (!items.length) break;

    for (const item of items) {
      const p = mapProgramme(item);
      if (p.programmeId) programmes.push(p);
    }

    totalPages = data.pagination?.totalPages ?? page;
    page += 1;
    if (items.length < LIMIT) break;
  }

  return programmes;
}

function mapKpi(raw: Record<string, unknown> | null | undefined): LinkhexaBrandKpi {
  const k = raw ?? {};
  return {
    epc:                    typeof k.epc === "number" ? k.epc : null,
    epcFormatted:           typeof k.epcFormatted === "string" ? k.epcFormatted : null,
    conversionRate:         typeof k.conversionRate === "number" ? k.conversionRate : null,
    conversionRateDisplay:  typeof k.conversionRateDisplay === "string" ? k.conversionRateDisplay : null,
    awinIndex:              typeof k.awinIndex === "number" ? k.awinIndex : null,
    validationDays:         typeof k.validationDays === "number" ? k.validationDays : null,
    approvalPercentage:     typeof k.approvalPercentage === "number" ? k.approvalPercentage : null,
    approvalPercentageDisplay:
      typeof k.approvalPercentageDisplay === "string" ? k.approvalPercentageDisplay : null,
    averagePaymentTime:     typeof k.averagePaymentTime === "string" ? k.averagePaymentTime : null,
    deeplinkEnabled:        typeof k.deeplinkEnabled === "boolean" ? k.deeplinkEnabled : null,
  };
}

function mapCreative(raw: Record<string, unknown>): LinkhexaCreative {
  return {
    promotionId:  Number(raw.promotionId ?? 0),
    type:         String(raw.type ?? ""),
    title:        String(raw.title ?? ""),
    description:  typeof raw.description === "string" ? raw.description : null,
    terms:        typeof raw.terms === "string" ? raw.terms : null,
    startDate:    typeof raw.startDate === "string" ? raw.startDate : null,
    endDate:      typeof raw.endDate === "string" ? raw.endDate : null,
    url:          typeof raw.url === "string" ? raw.url : null,
    urlTracking:  typeof raw.urlTracking === "string" ? raw.urlTracking : null,
    voucherCode:  typeof raw.voucherCode === "string" ? raw.voucherCode : null,
    imageUrl:     typeof raw.imageUrl === "string" ? raw.imageUrl : null,
  };
}

function mapCommissionRanges(raw: unknown): LinkhexaCommissionRange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
    .map((r) => ({
      type: typeof r.type === "string" ? r.type : undefined,
      min:  typeof r.min === "number" ? r.min : undefined,
      max:  typeof r.max === "number" ? r.max : undefined,
    }));
}

/** GET /api/v1/brands/{programmeId} — EPC, commission, creatives (24h cache; ?refresh=1 refetches Awin on Linkhexa). */
export async function fetchBrandDetail(
  programmeId: string | number,
  opts?: { refresh?: boolean; timeoutMs?: number },
): Promise<LinkhexaBrandDetail | null> {
  const qs = opts?.refresh ? "?refresh=1" : "";
  const res = await apiFetch(
    `/api/v1/brands/${encodeURIComponent(String(programmeId))}${qs}`,
    { timeoutMs: opts?.timeoutMs },
  );
  if (!res.ok) return null;

  const data = await res.json() as {
    brand?: Record<string, unknown>;
    commission?: Record<string, unknown>;
    kpi?: Record<string, unknown>;
    creatives?: Record<string, unknown>[];
    detailsMeta?: LinkhexaBrandDetail["detailsMeta"];
  };

  if (!data.brand) return null;

  const comm = data.commission ?? {};
  return {
    brand: mapProgramme(data.brand),
    commission: {
      summary: typeof comm.summary === "string" ? comm.summary : null,
      ranges:  mapCommissionRanges(comm.ranges ?? comm.rangesRaw),
    },
    kpi: mapKpi(data.kpi),
    creatives: (data.creatives ?? []).map(mapCreative),
    detailsMeta: data.detailsMeta,
  };
}

/** @deprecated Use fetchBrandDetail */
export async function fetchProgramme(programmeId: string | number): Promise<LinkhexaProgramme | null> {
  const detail = await fetchBrandDetail(programmeId);
  return detail?.brand ?? null;
}

export async function createTrackingLink(programmeId: number): Promise<LinkhexaTrackingLink> {
  const res = await apiFetch("/api/v1/tracking-links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ programmeId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Linkhexa tracking-links API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { link?: Record<string, unknown>; error?: string };
  if (!data.link) throw new Error(data.error ?? "No tracking link returned");

  const link = data.link;
  const slug = String(link.slug ?? "").trim();
  const trackingUrl = String(link.trackingUrl ?? "").trim();
  if (!slug || !trackingUrl) throw new Error("Invalid tracking link response");

  return {
    slug,
    programmeId: Number(link.programmeId ?? programmeId),
    trackingUrl,
    targetUrl:   String(link.targetUrl ?? trackingUrl),
    deepLink:    link.deepLink === true,
  };
}

export async function fetchTransactionsWindow(
  fromDate: string,
  toDate: string,
  partnerOnly = true,
): Promise<LinkhexaTransaction[]> {
  const params = new URLSearchParams({
    from: fromDate.slice(0, 10),
    to:   toDate.slice(0, 10),
    partnerOnly: partnerOnly ? "1" : "0",
    limit: "500",
  });

  const txns: LinkhexaTransaction[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    params.set("page", String(page));
    const res = await apiFetch(`/api/v1/transactions?${params}`);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Linkhexa transactions API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json() as {
      transactions?: Record<string, unknown>[];
      pagination?: { totalPages?: number };
    };
    const items = data.transactions ?? [];
    for (const item of items) {
      const t = mapTransaction(item);
      if (t) txns.push(t);
    }

    totalPages = data.pagination?.totalPages ?? page;
    page += 1;
    if (!items.length) break;
  }

  return txns;
}

/** API allows max 31-day windows — chunk longer ranges. */
export async function fetchTransactions(opts: {
  fromDate?: string;
  toDate?: string;
  deltaDays?: number;
} = {}): Promise<LinkhexaTransaction[]> {
  const end = opts.toDate ? new Date(opts.toDate) : new Date();
  const start = opts.fromDate
    ? new Date(opts.fromDate)
    : new Date(end.getTime() - (opts.deltaDays ?? 90) * 86400_000);

  const all: LinkhexaTransaction[] = [];
  const seen = new Set<string>();
  const chunkMs = 31 * 86400_000;

  for (let cur = new Date(start); cur <= end; ) {
    const chunkEnd = new Date(Math.min(cur.getTime() + chunkMs - 86400_000, end.getTime()));
    const batch = await fetchTransactionsWindow(
      cur.toISOString().slice(0, 10),
      chunkEnd.toISOString().slice(0, 10),
    );
    for (const t of batch) {
      if (!seen.has(t.linkhexaTxnId)) {
        seen.add(t.linkhexaTxnId);
        all.push(t);
      }
    }
    cur = new Date(chunkEnd.getTime() + 86400_000);
  }

  return all;
}

export async function testConnection(): Promise<{ ok: boolean; programmeCount: number }> {
  const res = await apiFetch("/api/v1/brands?page=1&limit=1");
  if (!res.ok) throw new Error(`Linkhexa API ${res.status}`);
  const data = await res.json() as { pagination?: { total?: number } };
  return { ok: true, programmeCount: data.pagination?.total ?? 0 };
}
