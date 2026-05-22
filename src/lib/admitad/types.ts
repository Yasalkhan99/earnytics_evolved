export type AdmitadCampaign = {
  campaignId:     string;
  name:           string;
  siteUrl:        string | null;
  logoUrl:        string | null;
  status:         string;
  currency:       string | null;
  rating:         string | null;
  ecpc:           number | null;
  commissionType: string | null;
  commissionRate: string | null;
  regions:        string[];
  categories:     string[];
  allowDeeplink:  boolean;
  connected:      boolean;
  description:    string | null;
};

export type AdmitadTransaction = {
  admitadId:    string;
  campaignId:   string | null;
  campaignName: string | null;
  action:       string | null;
  status:       string;
  payment:      number;
  currency:     string;
  creationDate: string | null;
  closeDate:    string | null;
  subid:        string | null;
};
