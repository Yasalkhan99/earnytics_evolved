import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { testConnection } from "@/lib/linkhexa/client";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey  = process.env.LINKHEXA_API_KEY ?? "";
  const baseUrl = process.env.LINKHEXA_API_BASE_URL ?? "https://www.linkhexa.com";

  return NextResponse.json({
    configured: !!(apiKey && baseUrl),
    apiKey:     apiKey ? "set" : "",
    baseUrl:    baseUrl || "",
  });
}

export async function POST(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await testConnection();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
