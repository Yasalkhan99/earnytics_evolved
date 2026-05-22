import LinkhexaBrandDetailContent from "./LinkhexaBrandDetailContent";

export default async function Page({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  return <LinkhexaBrandDetailContent campaignId={campaignId} />;
}
