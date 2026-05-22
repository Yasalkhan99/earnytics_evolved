export type LinkhexaProgramme = {
  programmeId: string;
  name: string;
  description: string | null;
  displayUrl: string | null;
  logoUrl: string | null;
  clickThroughUrl: string | null;
  currencyCode: string | null;
  programmeStatus: string;
  primaryRegion: string | null;
  countryCode: string | null;
  validDomains: unknown;
};

export type LinkhexaCommissionRange = {
  type?: string;
  min?: number;
  max?: number;
};

export type LinkhexaBrandKpi = {
  epc: number | null;
  epcFormatted: string | null;
  conversionRate: number | null;
  conversionRateDisplay: string | null;
  awinIndex: number | null;
  validationDays: number | null;
  approvalPercentage: number | null;
  approvalPercentageDisplay: string | null;
  averagePaymentTime: string | null;
  deeplinkEnabled: boolean | null;
};

export type LinkhexaCreative = {
  promotionId: number;
  type: string;
  title: string;
  description: string | null;
  terms: string | null;
  startDate: string | null;
  endDate: string | null;
  url: string | null;
  urlTracking: string | null;
  voucherCode: string | null;
  imageUrl: string | null;
};

export type LinkhexaBrandDetail = {
  brand: LinkhexaProgramme;
  commission: {
    summary: string | null;
    ranges: LinkhexaCommissionRange[];
  };
  kpi: LinkhexaBrandKpi;
  creatives: LinkhexaCreative[];
  detailsMeta?: {
    syncedAt?: string;
    source?: string;
    cacheTtlHours?: number;
  };
};

export type LinkhexaTrackingLink = {
  slug: string;
  programmeId: number;
  trackingUrl: string;
  targetUrl: string;
  deepLink: boolean;
};

export type LinkhexaTransaction = {
  linkhexaTxnId: string;
  programmeId: string | null;
  programmeName: string | null;
  saleAmount: number;
  commissionAmount: number;
  currency: string;
  transactionDate: string | null;
  status: string;
  clickRef: string | null;
};
