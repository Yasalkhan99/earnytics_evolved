import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { createTrackingLink } from "@/lib/linkhexa/client";
import { getSiteOrigin } from "@/lib/site-origin";

export async function POST(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  let body: { campaignId?: unknown; programmeId?: unknown } = {};
  try { body = await request.json(); } catch { /* default */ }

  const programmeIdRaw = body.programmeId ?? body.campaignId;
  const programmeId = Number(programmeIdRaw);
  const programmeIdStr = String(programmeIdRaw ?? "").trim();

  if (!Number.isFinite(programmeId) || !programmeIdStr)
    return NextResponse.json({ error: "programmeId required" }, { status: 400 });

  const supabase = createServerSupabaseClient();

  const { data: app } = await supabase
    .from("publisher_linkhexa_applications")
    .select("status")
    .eq("publisher_id", pub.userId)
    .eq("programme_id", programmeIdStr)
    .maybeSingle();

  if (!app || app.status !== "approved")
    return NextResponse.json({ error: "You need an approved application for this programme to create links." }, { status: 403 });

  let link;
  try {
    link = await createTrackingLink(programmeId);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("LINKHEXA_API_KEY")) {
      return NextResponse.json(
        {
          error:
            "Linkhexa is not configured on this server. In Vercel → Settings → Environment Variables, add LINKHEXA_API_KEY and LINKHEXA_API_BASE_URL, then redeploy.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { error } = await supabase.from("publisher_go_links").insert({
    slug:         link.slug,
    publisher_id: pub.userId,
    campaign_id:  programmeIdStr,
    target_url:   link.trackingUrl,
    deep_link:    link.deepLink,
    network:      "linkhexa",
  });

  if (error) {
    if (error.code === "23505")
      return NextResponse.json(
        { error: "This slug already exists. Try again — Linkhexa should return a new slug." },
        { status: 409 },
      );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = getSiteOrigin();
  const earnyticsShortUrl = `${origin}/go/short/${link.slug}`;

  return NextResponse.json({
    ok: true,
    slug:       link.slug,
    shortUrl:   earnyticsShortUrl,
    linkhexaUrl: link.trackingUrl,
    targetUrl:  link.trackingUrl,
    awinTarget: link.targetUrl,
  });
}
