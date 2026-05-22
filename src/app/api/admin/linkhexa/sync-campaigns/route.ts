import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchProgrammes } from "@/lib/linkhexa/client";

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServerSupabaseClient();

  let programmes;
  try {
    programmes = await fetchProgrammes();
  } catch (e) {
    await supabase.from("linkhexa_sync_state").upsert({
      id: "default", last_error: String(e), updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  if (!programmes.length)
    return NextResponse.json({ ok: true, upserted: 0, total: 0 });

  const rows = programmes.map((p) => ({
    programme_id:      p.programmeId,
    name:              p.name,
    description:       p.description,
    display_url:       p.displayUrl,
    logo_url:          p.logoUrl,
    click_through_url: p.clickThroughUrl,
    currency_code:     p.currencyCode,
    programme_status:  p.programmeStatus,
    primary_region:    p.primaryRegion,
    country_code:      p.countryCode,
    valid_domains:     p.validDomains,
    raw:               p,
    fetched_at:        new Date().toISOString(),
  }));

  const CHUNK = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("linkhexa_programmes")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "programme_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    upserted += Math.min(CHUNK, rows.length - i);
  }

  await supabase.from("linkhexa_sync_state").upsert({
    id: "default", last_completed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString(),
  }, { onConflict: "id" });

  return NextResponse.json({ ok: true, upserted, total: programmes.length });
}
