export type YieldkitCampaign = {
  advertiserId: string;
  name: string;
  url: string | null;
  logoUrl: string | null;
  country: string | null;
  status: string;           // ACTIVE | INACTIVE
  commissionType: string | null;
  commissionRate: string | null;
  description: string | null;
};

export type YieldkitTransaction = {
  ykId: string;            // "id" from API
  advertiserName: string | null;
  advertiserId: string | null;
  commission: number;
  amount: number;           // order/sale amount
  currency: string;
  state: string;            // CONFIRMED | OPEN | REJECTED | DELAYED | PAID
  date: string | null;
  modifiedDate: string | null;
  ykTag: string | null;     // sub-ID tracking = our go-link slug
  orderId: string | null;
  commissionType: string | null;
  payoutId: number | null;
  siteId: string | null;
};
