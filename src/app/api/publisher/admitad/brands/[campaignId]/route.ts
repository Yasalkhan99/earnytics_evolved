import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { isAdmitadTestCampaign } from "@/lib/admitad/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const { campaignId } = await params;
  const supabase = createServerSupabaseClient();

  const { data: campaign, error } = await supabase
    .from("admitad_campaigns")
    .select("*")
    .eq("campaign_id", campaignId)
    .single();

  if (error || !campaign || isAdmitadTestCampaign(campaign)) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const [appRes, linksRes] = await Promise.all([
    supabase.from("publisher_admitad_applications")
      .select("status,applied_at")
      .eq("publisher_id", pub.userId)
      .eq("campaign_id", campaignId)
      .maybeSingle(),
    supabase.from("publisher_go_links")
      .select("id,slug,target_url,deep_link,created_at")
      .eq("publisher_id", pub.userId)
      .eq("network", "admitad")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    campaign,
    applicationStatus: appRes.data?.status ?? null,
    goLinks: linksRes.data ?? [],
  });
}
