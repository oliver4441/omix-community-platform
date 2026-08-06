/**
 * Supabase migration status checker for Omix Community.
 *
 * The schema DDL lives in `supabase/migrations/*.sql` and is applied
 * out-of-band (Supabase SQL editor or `supabase db push`). The files are
 * idempotent (`CREATE TABLE IF NOT EXISTS ...`), so re-running them is safe.
 *
 * This script connects with the public anon key (the same one the client
 * ships — no secrets needed) and reports which tables from the migration
 * files already exist, so you know exactly what still needs applying.
 *
 * Usage:
 *   node scripts/migrate-supabase.js
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// Public anon key — same value as src/lib/supabase.ts. The service-role key is
// deliberately NOT used here (server-side only, via the Cloudflare Workers).
const SUPABASE_URL = "https://frcmgkayluazwkokywux.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyY21na2F5bHV6ZWt5d3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NDMzNzMsImV4cCI6MjEwMDMxOTM3M30.rDriWj_mHifzH3dSDOyNinNZM01Q-WADntw9-gtRDTM";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

/** Extract `CREATE TABLE public.xxx` names from a SQL file. */
function extractTables(sql) {
  const tables = new Set();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)/gi;
  let match;
  while ((match = re.exec(sql)) !== null) tables.add(match[1].toLowerCase());
  return [...tables];
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      fetch: (input, init) =>
        // Fail fast instead of hanging when the DB is unreachable.
        fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }),
    },
  });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log("🚀 Omix migration status check");
  console.log(`📁 Found ${files.length} migration file(s):`);
  for (const f of files) console.log(`   • ${f}`);

  const allTables = new Set();
  for (const f of files) {
    for (const t of extractTables(readFileSync(join(MIGRATIONS_DIR, f), "utf8"))) {
      allTables.add(t);
    }
  }

  console.log(`\n🔎 Checking ${allTables.size} table(s) from migrations…`);

  // Run checks in parallel so a slow/unreachable DB fails fast instead of
  // waiting N × 8s sequentially.
  const checks = await Promise.all(
    [...allTables].map(async (table) => {
      const { error } = await supabase.from(table).select("*").limit(1);
      const isMissing =
        error && /Could not find the table|relation .* does not exist/i.test(error.message);
      const isAuth =
        error && /JWT|jwt|unauthorized|permission denied|invalid api key/i.test(error.message);
      return { table, isMissing, isAuth };
    })
  );

  const present = checks.filter((c) => !c.isMissing).map((c) => c.table);
  const missing = checks.filter((c) => c.isMissing).map((c) => c.table);
  const authBlocked = checks.filter((c) => c.isAuth);

  for (const t of present) console.log(`   ✅ ${t}`);
  for (const t of missing) console.log(`   ❌ ${t} — MISSING (apply migrations)`);

  console.log(`\n📊 ${present.length}/${allTables.size} tables present`);
  if (authBlocked.length > 0) {
    console.log(
      "\n⚠️  The anon key was rejected — results may be unreliable. Verify the key\n" +
        "   in src/lib/supabase.ts matches your Supabase project."
    );
    process.exit(2);
  }
  if (missing.length > 0) {
    console.log(
      "\n❌ Some tables are missing. Apply the SQL in supabase/migrations/ via the\n" +
        "   Supabase SQL editor (`supabase db push` also works)."
    );
    process.exit(1);
  }
  console.log("\n✅ Database schema is fully migrated.");
  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Migration check failed:", err);
  process.exit(1);
});
