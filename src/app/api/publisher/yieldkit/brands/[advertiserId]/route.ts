import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ advertiserId: string }> }
) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const { advertiserId } = await params;
  const supabase = createServerSupabaseClient();

  const [{ data: campaign, error: cErr }, { data: app }, { data: goLinks }] = await Promise.all([
    supabase
      .from("yieldkit_campaigns")
      .select("*")
      .eq("advertiser_id", advertiserId)
      .maybeSingle(),
    supabase
      .from("publisher_yieldkit_applications")
      .select("status")
      .eq("publisher_id", pub.userId)
      .eq("advertiser_id", advertiserId)
      .maybeSingle(),
    supabase
      .from("publisher_go_links")
      .select("id, slug, target_url, deep_link, created_at, click_count")
      .eq("publisher_id", pub.userId)
      .eq("campaign_id", advertiserId)
      .eq("network", "yieldkit")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  return NextResponse.json({
    campaign,
    applicationStatus: app?.status ?? null,
    goLinks: goLinks ?? [],
  });
}
