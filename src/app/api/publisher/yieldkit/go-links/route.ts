import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { getSiteOrigin } from "@/lib/site-origin";
import { buildTrackingUrl } from "@/lib/yieldkit/client";

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

  let body: { advertiserId?: unknown; landingPage?: unknown } = {};
  try { body = await request.json(); } catch { /* default */ }

  const advertiserId = typeof body.advertiserId === "string" ? body.advertiserId.trim() : "";
  if (!advertiserId) return NextResponse.json({ error: "advertiserId required" }, { status: 400 });

  const landingRaw = typeof body.landingPage === "string" ? body.landingPage.trim() : "";

  const supabase = createServerSupabaseClient();

  // Verify approved application
  const { data: app } = await supabase
    .from("publisher_yieldkit_applications")
    .select("status")
    .eq("publisher_id", pub.userId)
    .eq("advertiser_id", advertiserId)
    .maybeSingle();

  if (!app || app.status !== "approved")
    return NextResponse.json({ error: "You need an approved application for this campaign to create links." }, { status: 403 });

  // Get the advertiser URL to affiliate
  const { data: campaign } = await supabase
    .from("yieldkit_campaigns")
    .select("url")
    .eq("advertiser_id", advertiserId)
    .maybeSingle();

  const baseUrl = landingRaw || campaign?.url || null;
  if (!baseUrl) return NextResponse.json({ error: "No URL available for this campaign. Sync campaigns first." }, { status: 400 });

  const origin = getSiteOrigin();

  for (let i = 0; i < 8; i++) {
    const slug      = makeSlug();
    const targetUrl = buildTrackingUrl(baseUrl, slug);

    const { error } = await supabase.from("publisher_go_links").insert({
      slug,
      publisher_id: pub.userId,
      campaign_id:  advertiserId,
      target_url:   targetUrl,
      deep_link:    Boolean(landingRaw),
      network:      "yieldkit",
    });

    if (!error)
      return NextResponse.json({ ok: true, slug, shortUrl: `${origin}/go/short/${slug}`, targetUrl });
    if (error.code !== "23505")
      return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ error: "Could not allocate a unique short code. Try again." }, { status: 500 });
}
