import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { getSiteOrigin } from "@/lib/site-origin";
import { buildTrackingUrl } from "@/lib/admitad/client";

const SLUG_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const SLUG_LEN   = 10;

function makeSlug(): string {
  const buf = randomBytes(SLUG_LEN);
  let s = "";
  for (let i = 0; i < SLUG_LEN; i++) s += SLUG_CHARS[buf[i]! % SLUG_CHARS.length];
  return s;
}

export async function POST(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  let body: { campaignId?: unknown; destinationUrl?: unknown } = {};
  try { body = await request.json(); } catch { /* default */ }

  const campaignId = typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  const landingRaw = typeof body.destinationUrl === "string" ? body.destinationUrl.trim() : "";

  const supabase = createServerSupabaseClient();

  // Verify approved application on Earnytics
  const { data: app } = await supabase
    .from("publisher_admitad_applications")
    .select("status")
    .eq("publisher_id", pub.userId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (!app || app.status !== "approved")
    return NextResponse.json({ error: "You need an approved application for this campaign to create links." }, { status: 403 });

  // Get the campaign URL + connected status
  const { data: campaign } = await supabase
    .from("admitad_campaigns")
    .select("site_url, connected")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  const baseUrl = landingRaw || campaign?.site_url || null;
  if (!baseUrl) return NextResponse.json({ error: "No URL available for this campaign." }, { status: 400 });

  const origin = getSiteOrigin();

  for (let i = 0; i < 8; i++) {
    const slug      = makeSlug();
    const targetUrl = buildTrackingUrl(campaignId, baseUrl, slug);

    const { error } = await supabase.from("publisher_go_links").insert({
      slug,
      publisher_id: pub.userId,
      campaign_id:  campaignId,
      target_url:   targetUrl,
      deep_link:    Boolean(landingRaw),
      network:      "admitad",
    });

    if (!error)
      return NextResponse.json({
        ok: true, slug,
        shortUrl: `${origin}/go/short/${slug}`,
        targetUrl,
        // Warn if publisher hasn't joined this campaign in Admitad's own system
        warning: campaign?.connected === false
          ? "Your Admitad publisher account is not yet connected to this campaign. Log in to publishers.admitad.com, join this campaign and get approved by the advertiser — otherwise the link will redirect to Admitad's offer wall instead of the merchant site."
          : null,
      });
    if (error.code !== "23505")
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Could not allocate a unique short code. Try again." }, { status: 500 });
}
