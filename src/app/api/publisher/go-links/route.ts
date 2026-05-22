import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { fetchAwinProgrammes, fetchAwinProgrammeDetails, generateAwinTrackingLink, isAwinConfigured } from "@/lib/awin/client";
import {
  collectMerchantHostsFromProgrammeDetails,
  landingHostMatchesApprovedHosts,
  mergeProgrammeRowHosts,
} from "@/lib/awin/merchant-landing-hosts";
import { getSiteOrigin } from "@/lib/site-origin";
import { normalizeDisplayUrl, resolveTrackedDestination } from "@/lib/go-link-target";

const SLUG_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const SLUG_LEN = 10;
const MAX_SLUG_TRIES = 8;

function makeSlug(): string {
  const buf = randomBytes(SLUG_LEN);
  let s = "";
  for (let i = 0; i < SLUG_LEN; i++) {
    s += SLUG_CHARS[buf[i]! % SLUG_CHARS.length];
  }
  return s;
}

function resolveLandingInput(raw: string, displayUrl: string | null): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("http://") || t.startsWith("https://")) {
    try {
      return new URL(t).toString();
    } catch {
      return null;
    }
  }
  const base = normalizeDisplayUrl(displayUrl);
  if (!base) return null;
  try {
    const path = t.startsWith("/") ? t : `/${t}`;
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

async function assertBrandAccess(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  userId: string,
  programmeId: number
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const { data: app } = await supabase
    .from("publisher_awin_applications")
    .select("status")
    .eq("publisher_id", userId)
    .eq("programme_id", programmeId)
    .maybeSingle();

  if (app) return { ok: true };

  try {
    const joined = await fetchAwinProgrammes({ relationship: "joined" });
    const ids = new Set(joined.map((p) => p.id));
    if (ids.has(programmeId)) return { ok: true };
  } catch {
    return { ok: false, status: 502, message: "Could not verify programme access with Awin." };
  }

  return { ok: false, status: 404, message: "Not found" };
}

export async function GET(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) {
    return NextResponse.json({ error: pub.message }, { status: pub.status });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("programmeId");
  const supabase = createServerSupabaseClient();
  const origin = getSiteOrigin();

  /** Dashboard: all short links for this publisher (newest first). */
  if (raw == null || raw.trim() === "") {
    const { data, error } = await supabase
      .from("publisher_go_links")
      .select("slug, target_url, deep_link, created_at, click_count, campaign_id, network")
      .eq("publisher_id", pub.userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];

    // Split campaign IDs by network
    const impactIds     = [...new Set(rows.filter(r => (r.network ?? "impact") === "impact").map(r => r.campaign_id).filter(Boolean))];
    const ttIds         = [...new Set(rows.filter(r => r.network === "tradetracker").map(r => r.campaign_id).filter(Boolean))];
    const porIds        = [...new Set(rows.filter(r => r.network === "paidonresults").map(r => r.campaign_id).filter(Boolean))];
    const ykIds         = [...new Set(rows.filter(r => r.network === "yieldkit").map(r => r.campaign_id).filter(Boolean))];
    const admitadIds    = [...new Set(rows.filter(r => r.network === "admitad").map(r => r.campaign_id).filter(Boolean))];
    const linkhexaIds   = [...new Set(rows.filter(r => r.network === "linkhexa").map(r => r.campaign_id).filter(Boolean))];

    const nameMap: Record<string, string>        = {};
    const logoMap: Record<string, string | null> = {};

    const [impactRes, ttRes, porRes, ykRes, admitadRes, linkhexaRes] = await Promise.all([
      impactIds.length > 0
        ? supabase.from("impact_campaigns").select("impact_id, name, logo_url").in("impact_id", impactIds)
        : { data: [] },
      ttIds.length > 0
        ? supabase.from("tradetracker_campaigns").select("tt_campaign_id, name, logo_url").in("tt_campaign_id", ttIds)
        : { data: [] },
      porIds.length > 0
        ? supabase.from("por_merchants").select("merchant_id, name, logo_url").in("merchant_id", porIds)
        : { data: [] },
      ykIds.length > 0
        ? supabase.from("yieldkit_campaigns").select("advertiser_id, name, logo_url").in("advertiser_id", ykIds)
        : { data: [] },
      admitadIds.length > 0
        ? supabase.from("admitad_campaigns").select("campaign_id, name, logo_url").in("campaign_id", admitadIds)
        : { data: [] },
      linkhexaIds.length > 0
        ? supabase.from("linkhexa_programmes").select("programme_id, name, logo_url").in("programme_id", linkhexaIds)
        : { data: [] },
    ]);

    for (const c of impactRes.data ?? []) {
      if (c.impact_id) {
        nameMap[c.impact_id] = c.name ?? c.impact_id;
        logoMap[c.impact_id] = `/api/impact-logo?c=${encodeURIComponent(c.impact_id)}`;
      }
    }
    for (const c of ttRes.data ?? []) {
      const id = (c as { tt_campaign_id: string; name: string; logo_url: string | null }).tt_campaign_id;
      if (id) {
        nameMap[id] = (c as { name: string }).name ?? id;
        logoMap[id] = (c as { logo_url: string | null }).logo_url ?? null;
      }
    }
    for (const c of porRes.data ?? []) {
      const id  = (c as { merchant_id: string; name: string; logo_url: string | null }).merchant_id;
      const raw = (c as { logo_url: string | null }).logo_url;
      if (id) {
        nameMap[id] = (c as { name: string }).name ?? id;
        logoMap[id] = raw ? `/api/por-logo?url=${encodeURIComponent(raw)}` : null;
      }
    }
    for (const c of ykRes.data ?? []) {
      const id  = (c as { advertiser_id: string; name: string; logo_url: string | null }).advertiser_id;
      const raw = (c as { logo_url: string | null }).logo_url;
      if (id) {
        nameMap[id] = (c as { name: string }).name ?? id;
        logoMap[id] = raw ?? null;
      }
    }
    for (const c of admitadRes.data ?? []) {
      const id  = (c as { campaign_id: string; name: string; logo_url: string | null }).campaign_id;
      const raw = (c as { logo_url: string | null }).logo_url;
      if (id) {
        nameMap[id] = (c as { name: string }).name ?? id;
        logoMap[id] = raw ?? null;
      }
    }
    for (const c of linkhexaRes.data ?? []) {
      const id  = (c as { programme_id: string; name: string; logo_url: string | null }).programme_id;
      const raw = (c as { logo_url: string | null }).logo_url;
      if (id) {
        nameMap[id] = (c as { name: string }).name ?? id;
        logoMap[id] = raw ?? null;
      }
    }

    const links = rows.map((row) => ({
      slug:        row.slug,
      shortUrl:    `${origin}/go/short/${row.slug}`,
      targetUrl:   row.target_url,
      deepLink:    row.deep_link,
      createdAt:   row.created_at,
      clickCount:  row.click_count,
      programmeId: row.campaign_id,
      campaignId:  row.campaign_id,
      network:     row.network ?? "impact",
      brandName:   nameMap[row.campaign_id] ?? row.campaign_id ?? null,
      logoUrl:     logoMap[row.campaign_id] ?? null,
    }));

    return NextResponse.json({ links });
  }

  // campaignId is a string (impact_campaigns.impact_id); legacy callers pass a number (Awin)
  const campaignId = raw.trim();
  if (!campaignId) {
    return NextResponse.json({ error: "Invalid campaignId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("publisher_go_links")
    .select("slug, target_url, deep_link, created_at, click_count")
    .eq("publisher_id", pub.userId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const links = (data ?? []).map((row) => ({
    slug: row.slug,
    shortUrl: `${origin}/go/short/${row.slug}`,
    targetUrl: row.target_url,
    deepLink: row.deep_link,
    createdAt: row.created_at,
    clickCount: row.click_count,
  }));

  return NextResponse.json({ links });
}

export async function POST(request: Request) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) {
    return NextResponse.json({ error: pub.message }, { status: pub.status });
  }

  let body: { programmeId?: unknown; deepLink?: unknown; landingPage?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const programmeId = typeof body.programmeId === "number" ? body.programmeId : Number(body.programmeId);
  if (!Number.isFinite(programmeId)) {
    return NextResponse.json({ error: "programmeId required" }, { status: 400 });
  }

  const deepLink = Boolean(body.deepLink);
  const landingRaw = typeof body.landingPage === "string" ? body.landingPage : "";

  const supabase = createServerSupabaseClient();

  const { data: app } = await supabase
    .from("publisher_awin_applications")
    .select("status")
    .eq("publisher_id", pub.userId)
    .eq("programme_id", programmeId)
    .maybeSingle();

  if (!app || app.status !== "approved") {
    return NextResponse.json({ error: "You need an approved application for this programme to create links." }, { status: 403 });
  }

  const access = await assertBrandAccess(supabase, pub.userId, programmeId);
  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const { data: row, error: rowErr } = await supabase
    .from("awin_programmes")
    .select("programme_id, display_url, click_through_url, valid_domains")
    .eq("programme_id", programmeId)
    .maybeSingle();

  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Programme not found" }, { status: 404 });
  }

  const displayUrl = row.display_url as string | null;
  const clickThrough = row.click_through_url as string | null;
  const validDomainsCol = row.valid_domains as string[] | null;

  let approvedHosts = mergeProgrammeRowHosts({
    displayUrl,
    clickThroughUrl: clickThrough,
    validDomains: validDomainsCol,
  });

  let resolvedDeep: string | null = null;
  if (deepLink && landingRaw.trim()) {
    resolvedDeep = resolveLandingInput(landingRaw, displayUrl);
    if (!resolvedDeep) {
      return NextResponse.json({ error: "Enter a valid landing page URL or path for this store." }, { status: 400 });
    }

    const ensureLandingAllowed = async (): Promise<boolean> => {
      if (landingHostMatchesApprovedHosts(resolvedDeep!, approvedHosts)) return true;
      if (!isAwinConfigured()) return false;
      try {
        const details = await fetchAwinProgrammeDetails(programmeId, { relationship: "any" });
        const fresh = collectMerchantHostsFromProgrammeDetails(details, displayUrl, clickThrough);
        await supabase.from("awin_programmes").update({ valid_domains: fresh }).eq("programme_id", programmeId);
        approvedHosts = fresh;
        return landingHostMatchesApprovedHosts(resolvedDeep!, approvedHosts);
      } catch {
        return false;
      }
    };

    if (!(await ensureLandingAllowed())) {
      return NextResponse.json(
        {
          error:
            "Landing page must use a domain allowed for this programme (e.g. your store URL or a domain listed by Awin for this advertiser, such as a regional .de site).",
        },
        { status: 400 }
      );
    }
    if (!isAwinConfigured()) {
      return NextResponse.json(
        {
          error:
            "Deep links with proper Awin tracking need AWIN_API_TOKEN and AWIN_PUBLISHER_ID on the server. Turn off deep link to use the stored click-through URL instead.",
        },
        { status: 503 }
      );
    }
  }

  let slug = "";
  let finalTargetUrl = "";
  let insertErr: { code?: string; message: string } | null = null;

  for (let i = 0; i < MAX_SLUG_TRIES; i++) {
    slug = makeSlug();

    let targetUrl: string | null = null;
    if (resolvedDeep) {
      try {
        const built = await generateAwinTrackingLink({
          advertiserId: programmeId,
          destinationUrl: resolvedDeep,
          parameters: { clickRef: slug },
        });
        targetUrl = built.url;
      } catch (e) {
        const detail = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json(
          {
            error:
              "Awin could not build a tracking link for this landing page. Some programmes disable link builder, or the URL may be invalid for this advertiser. Try without deep link or another path.",
            detail,
          },
          { status: 502 }
        );
      }
    } else {
      targetUrl = await resolveTrackedDestination(programmeId, displayUrl, clickThrough, slug);
    }

    if (!targetUrl) {
      return NextResponse.json(
        { error: "No destination URL available. Ask an admin to sync this programme so click-through or store URL is set." },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("publisher_go_links").insert({
      slug,
      publisher_id: pub.userId,
      programme_id: programmeId,
      target_url: targetUrl,
      deep_link: deepLink && Boolean(landingRaw.trim()),
    });
    if (!error) {
      insertErr = null;
      finalTargetUrl = targetUrl;
      break;
    }
    if (error.code === "23505") {
      insertErr = error;
      continue;
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (insertErr) {
    return NextResponse.json({ error: "Could not allocate a unique short code. Try again." }, { status: 500 });
  }

  const origin = getSiteOrigin();
  const shortUrl = `${origin}/go/short/${slug}`;

  return NextResponse.json({ ok: true, slug, shortUrl, targetUrl: finalTargetUrl });
}
