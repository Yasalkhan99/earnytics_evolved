import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireApprovedPublisher } from "@/lib/publisher-session";
import { fetchBrandDetail } from "@/lib/linkhexa/client";
import type { LinkhexaBrandKpi, LinkhexaCreative } from "@/lib/linkhexa/types";
import {
  commissionFromProgrammeRow,
  linkhexaDetailToCommissionCache,
  LINKHEXA_COMMISSION_CACHE_MS,
} from "@/lib/linkhexa/commission";

type ProgrammeRow = Record<string, unknown>;

function buildPayload(
  programme: ProgrammeRow,
  commission: ReturnType<typeof commissionFromProgrammeRow>,
  extras: {
    kpi?: LinkhexaBrandKpi | null;
    creatives?: LinkhexaCreative[];
    applicationStatus: string | null;
    goLinks: unknown[];
    enrichPending?: boolean;
  },
) {
  return {
    campaign: {
      campaign_id:       programme.programme_id,
      name:              programme.name,
      site_url:          programme.display_url,
      logo_url:          programme.logo_url,
      status:            programme.programme_status,
      currency:          programme.currency_code,
      description:       programme.description,
      click_through_url: programme.click_through_url,
      primary_region:    programme.primary_region,
      country_code:      programme.country_code,
      commission_summary: commission.commissionSummary,
      commission_type:    commission.commissionType,
      epc:                commission.epc,
      conversion_rate:    commission.conversionRate,
      validation_days:    commission.validationDays,
      deeplink_enabled:   commission.deeplinkEnabled,
    },
    commission,
    kpi: extras.kpi ?? null,
    creatives: extras.creatives ?? [],
    applicationStatus: extras.applicationStatus,
    goLinks: extras.goLinks,
    enrichPending: extras.enrichPending ?? false,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ programmeId: string }> }
) {
  const pub = await requireApprovedPublisher();
  if (!pub.ok) return NextResponse.json({ error: pub.message }, { status: pub.status });

  const { programmeId } = await params;
  const url = new URL(request.url);
  const fast = url.searchParams.get("fast") === "1";
  const enrich = url.searchParams.get("enrich") === "1";
  const refresh = url.searchParams.get("refresh") === "1";

  const supabase = createServerSupabaseClient();

  const [programmeRes, appRes, linksRes] = await Promise.all([
    supabase.from("linkhexa_programmes").select("*").eq("programme_id", programmeId).single(),
    supabase.from("publisher_linkhexa_applications")
      .select("status,applied_at")
      .eq("publisher_id", pub.userId)
      .eq("programme_id", programmeId)
      .maybeSingle(),
    supabase.from("publisher_go_links")
      .select("id,slug,target_url,deep_link,created_at")
      .eq("publisher_id", pub.userId)
      .eq("network", "linkhexa")
      .eq("campaign_id", programmeId)
      .order("created_at", { ascending: false }),
  ]);

  const programme = programmeRes.data;
  if (programmeRes.error || !programme) {
    return NextResponse.json({ error: "Programme not found" }, { status: 404 });
  }

  const applicationStatus = appRes.data?.status ?? null;
  const goLinks = linksRes.data ?? [];
  let commission = commissionFromProgrammeRow(programme);

  const fetchedAt = programme.commission_fetched_at as string | null | undefined;
  const stale =
    !fetchedAt ||
    Date.now() - new Date(fetchedAt).getTime() > LINKHEXA_COMMISSION_CACHE_MS;
  const hasFreshCache = Boolean(!stale && (programme.epc || programme.commission_summary));

  // Fast path: Supabase only (~100–300ms). Client loads EPC/creatives in background.
  if (fast || (!enrich && !refresh && hasFreshCache)) {
    return NextResponse.json(
      buildPayload(programme, commission, {
        applicationStatus,
        goLinks,
        enrichPending: !hasFreshCache,
      }),
    );
  }

  // Enrich path: Linkhexa API (often 4–20s on cold cache).
  let creatives: LinkhexaCreative[] = [];
  let kpi: LinkhexaBrandKpi | null = null;

  try {
    const detail = await fetchBrandDetail(programmeId, { refresh });
    if (detail) {
      creatives = detail.creatives;
      kpi = detail.kpi;

      const cache = linkhexaDetailToCommissionCache(detail);
      if (stale || refresh) {
        await supabase.from("linkhexa_programmes").update(cache).eq("programme_id", programmeId);
      }

      commission = {
        commissionSummary: cache.commission_summary,
        commissionType:    cache.commission_type,
        epc:               cache.epc,
        conversionRate:    cache.conversion_rate,
        validationDays:    cache.validation_days,
        deeplinkEnabled:   cache.deeplink_enabled,
        source: "linkhexa",
      };
    }
  } catch {
    // keep DB fallback
  }

  return NextResponse.json(
    buildPayload(programme, commission, {
      kpi,
      creatives,
      applicationStatus,
      goLinks,
      enrichPending: false,
    }),
  );
}
