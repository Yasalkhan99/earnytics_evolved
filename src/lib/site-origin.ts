/**
 * Canonical site origin for absolute URLs (short links, emails).
 * Set NEXT_PUBLIC_APP_URL in production (e.g. https://linkhexa.com).
 */
export function getSiteOrigin(): string {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL)?.trim();
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

  if (explicit) {
    const url = explicit.replace(/\/$/, "");
    // On Vercel, ignore localhost left in env — use deployment / custom domain instead
    if (!isProd || !/localhost|127\.0\.0\.1/i.test(url)) {
      return url;
    }
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
