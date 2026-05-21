import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { fetchCampaigns } from "@/lib/yieldkit/client";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey    = process.env.YIELDKIT_API_KEY    ?? "";
  const apiSecret = process.env.YIELDKIT_API_SECRET ?? "";
  const siteId    = process.env.YIELDKIT_SITE_ID    ?? "";
  const domain    = process.env.YIELDKIT_DOMAIN     ?? "";

  return NextResponse.json({
    configured:  !!(apiKey && apiSecret && siteId),
    apiKey:      apiKey    ? "set" : "",
    apiSecret:   apiSecret ? "set" : "",
    siteId:      siteId    ? "set" : "",
    domain:      domain    ? domain : "",
  });
}

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey    = process.env.YIELDKIT_API_KEY    ?? "";
  const apiSecret = process.env.YIELDKIT_API_SECRET ?? "";
  const siteId    = process.env.YIELDKIT_SITE_ID    ?? "";

  if (!apiKey || !apiSecret || !siteId) {
    return NextResponse.json({ error: "YIELDKIT_API_KEY, YIELDKIT_API_SECRET or YIELDKIT_SITE_ID not set." }, { status: 400 });
  }

  try {
    const campaigns = await fetchCampaigns();
    return NextResponse.json({ ok: true, campaignCount: campaigns.length, siteId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
