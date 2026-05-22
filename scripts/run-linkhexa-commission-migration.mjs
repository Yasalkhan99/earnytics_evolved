/**
 * Add commission columns to linkhexa_programmes via Supabase Management API.
 * Usage: node scripts/run-linkhexa-commission-migration.mjs
 * Optional: SUPABASE_ACCESS_TOKEN in .env.local (personal access token from supabase.com/dashboard/account/tokens)
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, "..", ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 1) continue;
  env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const token =
  env.SUPABASE_ACCESS_TOKEN?.trim() ||
  env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SUPABASE_URL || !token) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or token in .env.local");
  process.exit(1);
}

const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
const sql = readFileSync(
  join(__dirname, "..", "supabase", "migrations", "linkhexa_commission_columns.sql"),
  "utf8",
);

async function main() {
  console.log(`Project: ${projectRef}`);
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    console.error(`Failed (${res.status}):`, text.slice(0, 500));
    console.log("\nRun manually in SQL Editor:");
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
    console.log("\nFile: supabase/migrations/linkhexa_commission_columns.sql");
    process.exit(1);
  }
  console.log("✓ Commission columns added:", text || "OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
