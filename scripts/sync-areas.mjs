/**
 * Extend the community registry from DLD's own area list.
 *
 * The first real ingest matched 71 of DLD's 127 areas. The rest are genuine
 * gaps in a hand-written crosswalk, and DLD is the authority on what the list
 * should be — so this reads the areas straight from the source and reconciles.
 *
 * Two things it fixes at once:
 *
 *   1. `communityNumber` has been null everywhere, because this project does
 *      not assert official identifiers it cannot source. DLD's `areaId` is
 *      that identifier, from DLD.
 *   2. Areas absent from the registry get added with both name forms, so the
 *      next ingest joins them instead of reporting them unresolved.
 *
 * The safety rule matters more than the coverage. Only exact and alias matches
 * auto-assign an areaId. A fuzzy match is reported for review and never
 * written: stamping an official identifier onto a community a matcher merely
 * guessed at would bake a wrong join into the registry permanently, and every
 * later ingest would inherit it silently. Coverage is recoverable, a corrupted
 * key is not.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getResolver } from "../dist/geo/communities.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = join(root, "data", "communities.json");

const GATEWAY = "https://gateway.dubailand.gov.ae";
const CONSUMER_ID = process.env.OPENDXB_DLD_CONSUMER_ID ?? "gkb3WvEG0rY9eilwXC0P2pTz8UzvLj9F";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "user-agent": "opendxb (+https://github.com/ahmedjola/opendxb) open-data client",
  referer: "https://dubailand.gov.ae/",
  origin: "https://dubailand.gov.ae",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Several months, both transaction kinds.
 *
 * A quiet area records nothing in a given month and simply would not appear,
 * so a single window under-reports the area list. The union across a spread of
 * months is much closer to DLD's true register.
 */
const WINDOWS = [
  ["2026-07-01", "2026-07-31"],
  ["2026-06-01", "2026-06-30"],
  ["2026-05-01", "2026-05-31"],
  ["2026-03-01", "2026-03-31"],
  ["2026-01-01", "2026-01-31"],
  ["2025-10-01", "2025-10-31"],
];

/** areaId -> { areaId, nameEn, nameAr } */
const areas = new Map();

for (const [from, to] of WINDOWS) {
  for (const kind of ["sales", "mortgage"]) {
    const url = `${GATEWAY}/areawise/transaction/${kind}?fromDate=${from}&toDate=${to}&consumer-id=${CONSUMER_ID}`;
    try {
      const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) { console.log(`  ${kind} ${from}: HTTP ${response.status}`); continue; }
      const rows = (await response.json())?.response?.result ?? [];
      let added = 0;
      for (const row of rows) {
        const areaId = row?.areaId;
        const nameEn = row?.area?.englishName?.trim();
        const nameAr = row?.area?.arabicName?.trim();
        if (typeof areaId !== "number" || !nameEn) continue;
        if (!areas.has(areaId)) { areas.set(areaId, { areaId, nameEn, nameAr: nameAr ?? "" }); added++; }
      }
      console.log(`  ${kind.padEnd(9)} ${from}..${to}  ${rows.length} rows, ${added} new areas (total ${areas.size})`);
    } catch (error) {
      console.log(`  ${kind} ${from}: ${error.cause?.code ?? error.message}`);
    }
    await sleep(1200);
  }
}

if (areas.size === 0) {
  console.error("No areas retrieved; refusing to rewrite the registry from nothing.");
  process.exit(1);
}

const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const bySlug = new Map(registry.communities.map((c) => [c.slug, c]));
const resolver = getResolver();

/** Slug from an English area name, matching the style already in the registry. */
function toSlug(nameEn) {
  return nameEn
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const assigned = [];
const added = [];
const needsReview = [];
const conflicts = [];
const takenIds = new Map();

for (const area of [...areas.values()].sort((a, b) => a.areaId - b.areaId)) {
  const resolution = resolver.resolve(area.nameEn);
  const match = resolution.match;

  // Fuzzy is not good enough to stamp an official identifier with.
  if (match && (match.kind === "exact" || match.kind === "alias")) {
    const community = bySlug.get(match.community.slug);
    if (!community) continue;

    const previous = takenIds.get(match.community.slug);
    if (previous && previous !== area.areaId) {
      // Two DLD areas resolving to one community means the registry is
      // conflating distinct places. Report rather than overwrite.
      conflicts.push({ slug: match.community.slug, ids: [previous, area.areaId], name: area.nameEn });
      continue;
    }
    takenIds.set(match.community.slug, area.areaId);

    community.communityNumber = area.areaId;
    // DLD is authoritative on the Arabic form; ours was hand-transcribed.
    if (area.nameAr && community.nameAr !== area.nameAr) {
      if (community.nameAr && !community.marketNamesAr.includes(community.nameAr)) {
        // Keep the old spelling as an alias so previously-working lookups
        // do not start failing.
        community.marketNamesAr.push(community.nameAr);
      }
      community.nameAr = area.nameAr;
    }
    assigned.push({ slug: community.slug, areaId: area.areaId, via: match.kind });
    continue;
  }

  if (match && match.kind === "fuzzy") {
    needsReview.push({ areaId: area.areaId, nameEn: area.nameEn, guess: match.community.slug, score: Number(match.score.toFixed(3)) });
    continue;
  }

  // Genuinely unknown to the registry: add it, sourced entirely from DLD.
  let slug = toSlug(area.nameEn);
  if (bySlug.has(slug)) slug = `${slug}-${area.areaId}`;
  const entry = {
    slug,
    nameEn: area.nameEn,
    nameAr: area.nameAr,
    marketNames: [],
    marketNamesAr: [],
    communityNumber: area.areaId,
    sectorNumber: null,
  };
  registry.communities.push(entry);
  bySlug.set(slug, entry);
  takenIds.set(slug, area.areaId);
  added.push(entry);
}

registry.communities.sort((a, b) => a.slug.localeCompare(b.slug));
registry.version = "0.2.0";
registry.about =
  "Curated crosswalk between Dubai Land Department official community names, their Arabic " +
  "forms, and the market names residents and portals actually use. communityNumber is DLD's " +
  "own areaId, read from its public gateway — never invented here. The alias layer mapping " +
  "market names (Dubai Marina, JLT, JVC, DIFC) onto official names is the hand-maintained " +
  "contribution, and is what lets a KHDA school row join to a DLD transaction row.";
registry.areasSyncedAt = new Date().toISOString();

writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);

console.log(`\n${"═".repeat(80)}`);
console.log(`DLD areas seen:            ${areas.size}`);
console.log(`Official ids assigned:     ${assigned.length}`);
console.log(`New communities added:     ${added.length}`);
console.log(`Registry total:            ${registry.communities.length}`);
console.log(`Fuzzy — needs review:      ${needsReview.length}`);
console.log(`Conflicts:                 ${conflicts.length}`);

if (added.length) {
  console.log(`\nADDED (from DLD):`);
  for (const entry of added.slice(0, 60)) console.log(`  ${String(entry.communityNumber).padStart(5)}  ${entry.slug.padEnd(38)} ${entry.nameEn}`);
  if (added.length > 60) console.log(`  … and ${added.length - 60} more`);
}
if (needsReview.length) {
  console.log(`\nNEEDS HUMAN REVIEW — fuzzy match, not auto-applied:`);
  for (const item of needsReview) console.log(`  ${String(item.areaId).padStart(5)}  ${item.nameEn.padEnd(34)} guessed ${item.guess} (${item.score})`);
}
if (conflicts.length) {
  console.log(`\nCONFLICTS — one community claimed by two DLD areas:`);
  for (const c of conflicts) console.log(`  ${c.slug}: ${c.ids.join(" vs ")} (${c.name})`);
}
