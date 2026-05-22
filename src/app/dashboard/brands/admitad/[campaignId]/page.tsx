import AdmitadBrandDetailContent from "./AdmitadBrandDetailContent";

export default async function Page({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <AdmitadBrandDetailContent campaignId={campaignId} />;
}
