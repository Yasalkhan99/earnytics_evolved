import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { getSiteOrigin } from "@/lib/site-origin";
import { buildPublisherTrackingUrl, isAdmitadTestCampaign } from "@/lib/admitad/client";

const SLUG_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const SLUG_LEN   = 10;

function makeSlug(): string {
  const buf = randomBytes(SLUG_LEN);
  let s = "";
  for (let i = 0; i < SLUG_LEN; i++) s += SLUG_CHARS[buf[i]! % SLUG_CHARS.length];
  return s;
}

function normalizeDestinationUrl(raw: string): string {
  const trimmed = raw.trim();
  const href = trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
  return new URL(href).href;
}

export async function POST(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  let body: { campaignId?: unknown; destinationUrl?: unknown } = {};
  try { body = await request.json(); } catch { /* default */ }

  const campaignId = typeof body.campaignId === "string" ? body.campaignId.trim() : "";
  if (!campaignId) return NextResponse.json({ error: "campaignId required" }, { status: 400 });

  let landingUrl: string | null = null;
  if (typeof body.destinationUrl === "string" && body.destinationUrl.trim()) {
    try {
      landingUrl = normalizeDestinationUrl(body.destinationUrl);
    } catch {
      return NextResponse.json({ error: "Enter a valid landing page URL." }, { status: 400 });
    }
  }

  const supabase = createServerSupabaseClient();

  const { data: app } = await supabase
    .from("publisher_admitad_applications")
    .select("status")
    .eq("publisher_id", pub.userId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (!app || app.status !== "approved") {
    return NextResponse.json({ error: "You need an approved application for this campaign to create links." }, { status: 403 });
  }

  const { data: campaign } = await supabase
    .from("admitad_campaigns")
    .select("campaign_id, name, site_url, connected, allow_deeplink")
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (!campaign || isAdmitadTestCampaign(campaign)) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const destinationUrl = landingUrl ?? campaign.site_url ?? null;
  if (!destinationUrl) {
    return NextResponse.json({ error: "No URL available for this campaign." }, { status: 400 });
  }

  const origin = getSiteOrigin();

  for (let i = 0; i < 8; i++) {
    const slug = makeSlug();
    let targetUrl: string;
    try {
      const built = await buildPublisherTrackingUrl({
        campaignId,
        subid: slug,
        destinationUrl: landingUrl,
      });
      targetUrl = built.targetUrl;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not build Admitad tracking link";
      const status = message.includes("not connected") || message.includes("does not support") ? 403 : 502;
      return NextResponse.json({ error: message }, { status });
    }

    const { error } = await supabase.from("publisher_go_links").insert({
      slug,
      publisher_id: pub.userId,
      campaign_id:  campaignId,
      target_url:   targetUrl,
      deep_link:    Boolean(landingUrl),
      network:      "admitad",
    });

    if (!error) {
      return NextResponse.json({
        ok: true,
        slug,
        shortUrl: `${origin}/go/short/${slug}`,
        targetUrl,
      });
    }
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not allocate a unique short code. Try again." }, { status: 500 });
}
