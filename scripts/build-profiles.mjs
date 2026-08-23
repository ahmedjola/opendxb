/**
 * Build small per-community aggregates from an ingest.
 *
 * The raw ingest is far too large to commit — DLD's full transaction history
 * alone runs to hundreds of megabytes. But the *aggregates* are tiny, and they
 * are what anything downstream actually reads: a web page, a chart, an agent
 * answering "what does it cost to live in JVC".
 *
 * So the nightly job commits these and keeps the raw data as a build artifact.
 * That makes the repo a small, versioned, public record of Dubai's community
 * statistics over time — which the underlying registries, publishing only
 * current state, do not provide.
 */
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { OpenDXB, FileStore, defaultDataDir } from "../dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "profiles");

const store = new FileStore(process.env.OPENDXB_DATA_DIR ?? defaultDataDir());
const ingested = await store.list();

if (ingested.length === 0) {
  console.error("No ingested sources found — nothing to aggregate. Run `opendxb ingest` first.");
  process.exit(1);
}
console.log(`Aggregating from ${ingested.length} source(s): ${ingested.join(", ")}`);

const dxb = new OpenDXB({ store });

// Rebuilt from scratch each run so a community that disappears upstream does
// not linger as a stale file forever.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const generatedAt = new Date().toISOString();
const index = [];
let written = 0;

for (const community of dxb.communities) {
  const profile = await dxb.profile(community.slug);

  // A community with no data in any source would just be noise in the index.
  const hasData =
    profile.sales.count || profile.rents.count ||
    profile.schools.count || profile.health.count || profile.transit.count;
  if (!hasData) continue;

  writeFileSync(
    join(outDir, `${community.slug}.json`),
    JSON.stringify({ generatedAt, ...profile }, null, 2),
  );
  written++;

  index.push({
    slug: community.slug,
    nameEn: community.nameEn,
    nameAr: community.nameAr,
    alsoKnownAs: community.marketNames,
    medianSaleAed: profile.sales.amountAed.median,
    medianAnnualRentAed: profile.rents.annualRentAed.median,
    grossYieldPct: profile.grossYieldPct,
    schools: profile.schools.count,
    healthFacilities: profile.health.count,
    transitStations: profile.transit.count,
  });
}

const provenance = {};
for (const sourceId of ingested) provenance[sourceId] = await store.meta(sourceId);

writeFileSync(
  join(outDir, "index.json"),
  JSON.stringify({ generatedAt, communityCount: index.length, provenance, communities: index }, null, 2),
);

console.log(`Wrote ${written} community profiles + index.json to data/profiles/`);
