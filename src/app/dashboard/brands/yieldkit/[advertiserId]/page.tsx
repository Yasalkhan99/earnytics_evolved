import YieldkitBrandDetailContent from "./YieldkitBrandDetailContent";

export default async function YieldkitBrandDetailPage({
  params,
}: {
  params: Promise<{ advertiserId: string }>;
}) {
  const { advertiserId } = await params;
  return <YieldkitBrandDetailContent advertiserId={advertiserId} />;
}
