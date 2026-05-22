import { NextResponse } from "next/server";
import { adminRequestIsAuthorized } from "@/lib/admin-session";
import { testConnection } from "@/lib/admitad/client";

export async function GET(request: Request) {
  if (!adminRequestIsAuthorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId      = process.env.ADMITAD_CLIENT_ID      ?? "";
  const clientSecret  = process.env.ADMITAD_CLIENT_SECRET  ?? "";
  const base64Header  = process.env.ADMITAD_BASE64_HEADER  ?? "";
  const publisherCode = process.env.ADMITAD_PUBLISHER_CODE ?? "";

  return NextResponse.json({
    configured:     !!(clientId && clientSecret),
    clientId:       clientId     ? "set" : "",
    clientSecret:   clientSecret ? "set" : "",
    base64Header:   base64Header ? "set" : "",
    publisherCode:  publisherCode || "",
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
