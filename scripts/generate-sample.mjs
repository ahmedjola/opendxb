/**
 * Generates the bundled synthetic sample used by `opendxb demo`.
 *
 * The sample exists so the SDK, CLI and MCP server are explorable in seconds
 * without Dubai Pulse credentials. It is generated from a seeded PRNG so the
 * output is byte-stable across runs, and every record carries `synthetic: true`
 * so it can never be mistaken for real registry data. Shapes and rough
 * magnitudes are plausible; the individual rows are invented.
 *
 * Run: node scripts/generate-sample.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "data", "samples");
mkdirSync(outDir, { recursive: true });

/** mulberry32 — small, fast, deterministic. */
function rng(seed) {
  return function next() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260910);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (lo, hi) => lo + rand() * (hi - lo);

/**
 * Communities in the sample, with a rough price tier so the generated numbers
 * are ordered the way the real market is (Palm above JVC, and so on).
 */
const AREAS = [
  { slug: "marsa-dubai",        raw: "Dubai Marina",              tier: 1.5 },
  { slug: "burj-khalifa",       raw: "Downtown Dubai",            tier: 1.9 },
  { slug: "nakhlat-jumeirah",   raw: "Palm Jumeirah",             tier: 3.1 },
  { slug: "business-bay",       raw: "Business Bay",              tier: 1.3 },
  { slug: "al-thanyah-fifth",   raw: "Jumeirah Lake Towers",      tier: 1.0 },
  { slug: "al-barsha-south-fourth", raw: "Jumeirah Village Circle", tier: 0.8 },
  { slug: "al-barsha-first",    raw: "Al Barsha First",           tier: 1.0 },
  { slug: "hadaeq-sheikh-mohammed-bin-rashid", raw: "Dubai Hills Estate", tier: 1.8 },
  { slug: "warsan-first",       raw: "International City",        tier: 0.45 },
  { slug: "madinat-al-mataar",  raw: "Dubai South",               tier: 0.6 },
];

const envelope = (sourceId, authority, records, endpoint) => ({
  meta: {
    sourceId, authority,
    ingestedAt: "2026-08-23T00:00:00.000Z",
    recordCount: records.length,
    endpoint,
    license: "SYNTHETIC SAMPLE — not Dubai open data",
    synthetic: true,
  },
  records,
});

const isoDate = (daysAgo) =>
  new Date(Date.UTC(2026, 7, 23) - daysAgo * 86400000).toISOString().slice(0, 10);

// --- transactions -----------------------------------------------------------
const transactions = [];
for (const area of AREAS) {
  const count = 60 + Math.floor(rand() * 60);
  for (let i = 0; i < count; i++) {
    const propertyType = rand() < 0.78 ? "apartment" : "villa";
    const areaSqm = Math.round(
      propertyType === "villa" ? between(180, 620) : between(45, 210),
    );
    const perSqm = Math.round(between(9000, 19000) * area.tier);
    const amountAed = Math.round((areaSqm * perSqm) / 1000) * 1000;
    const kind = rand() < 0.72 ? "sale" : rand() < 0.85 ? "mortgage" : "gift";
    transactions.push({
      source: "dld.transactions", authority: "DLD",
      communitySlug: area.slug, rawLocation: area.raw,
      id: `SYN-TX-${area.slug}-${i}`,
      date: isoDate(Math.floor(rand() * 900)),
      kind, propertyType,
      rooms: propertyType === "villa" ? pick(["3 B/R", "4 B/R", "5 B/R"]) : pick(["Studio", "1 B/R", "2 B/R", "3 B/R"]),
      areaSqm, amountAed,
      pricePerSqm: Math.round(amountAed / areaSqm),
      projectName: null,
      isOffPlan: rand() < 0.42,
      synthetic: true,
    });
  }
}

// --- rents ------------------------------------------------------------------
const rents = [];
for (const area of AREAS) {
  const count = 50 + Math.floor(rand() * 50);
  for (let i = 0; i < count; i++) {
    const propertyType = rand() < 0.8 ? "apartment" : "villa";
    const areaSqm = Math.round(propertyType === "villa" ? between(180, 600) : between(45, 200));
    // Rents are generated to land in a plausible 5-8% gross yield band.
    const annualRentAed = Math.round((areaSqm * between(9000, 19000) * area.tier * between(0.05, 0.08)) / 500) * 500;
    const startDate = isoDate(Math.floor(rand() * 700));
    rents.push({
      source: "dld.rents", authority: "DLD",
      communitySlug: area.slug, rawLocation: area.raw,
      id: `SYN-RENT-${area.slug}-${i}`,
      startDate,
      endDate: isoDate(Math.floor(rand() * 700) - 365),
      annualRentAed, areaSqm,
      rooms: propertyType === "villa" ? pick(["3 B/R", "4 B/R"]) : pick(["Studio", "1 B/R", "2 B/R"]),
      propertyType,
      isRenewal: rand() < 0.55,
      synthetic: true,
    });
  }
}

// --- schools ----------------------------------------------------------------
const RATINGS = ["Outstanding", "Very Good", "Good", "Acceptable", "Weak"];
const CURRICULA = ["UK", "US", "IB", "Indian", "MoE"];
const schools = [];
for (const area of AREAS) {
  const count = Math.floor(rand() * 5);
  for (let i = 0; i < count; i++) {
    const feeMinAed = Math.round(between(14000, 40000) * area.tier / 1000) * 1000;
    schools.push({
      source: "khda.schools", authority: "KHDA",
      communitySlug: area.slug, rawLocation: area.raw,
      id: `SYN-SCH-${area.slug}-${i}`,
      nameEn: `${area.raw} International School ${i + 1}`,
      nameAr: null,
      curriculum: pick(CURRICULA),
      rating: pick(RATINGS),
      studentCount: Math.round(between(400, 2400)),
      feeMinAed,
      feeMaxAed: feeMinAed + Math.round(between(8000, 30000) / 1000) * 1000,
      synthetic: true,
    });
  }
}

// --- health facilities ------------------------------------------------------
const FACILITY_TYPES = ["Hospital", "Clinic", "Pharmacy", "Diagnostic Centre"];
const facilities = [];
for (const area of AREAS) {
  const count = 2 + Math.floor(rand() * 8);
  for (let i = 0; i < count; i++) {
    facilities.push({
      source: "dha.facilities", authority: "DHA",
      communitySlug: area.slug, rawLocation: area.raw,
      id: `SYN-DHA-${area.slug}-${i}`,
      nameEn: `${area.raw} ${pick(FACILITY_TYPES)} ${i + 1}`,
      nameAr: null,
      facilityType: pick(FACILITY_TYPES),
      sector: rand() < 0.85 ? "private" : "public",
      synthetic: true,
    });
  }
}

// --- transit ----------------------------------------------------------------
const stations = [];
for (const area of AREAS) {
  const count = Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    stations.push({
      source: "rta.stations", authority: "RTA",
      communitySlug: area.slug, rawLocation: area.raw,
      id: `SYN-RTA-${area.slug}-${i}`,
      nameEn: `${area.raw} Station ${i + 1}`,
      nameAr: null,
      mode: rand() < 0.6 ? "metro" : "tram",
      line: pick(["Red", "Green"]),
      lat: Number(between(24.95, 25.30).toFixed(5)),
      lng: Number(between(55.10, 55.40).toFixed(5)),
      synthetic: true,
    });
  }
}

const files = [
  ["dld.transactions.json", envelope("dld.transactions", "DLD", transactions, "SYNTHETIC")],
  ["dld.rents.json", envelope("dld.rents", "DLD", rents, "SYNTHETIC")],
  ["khda.schools.json", envelope("khda.schools", "KHDA", schools, "SYNTHETIC")],
  ["dha.facilities.json", envelope("dha.facilities", "DHA", facilities, "SYNTHETIC")],
  ["rta.stations.json", envelope("rta.stations", "RTA", stations, "SYNTHETIC")],
];

for (const [name, data] of files) {
  writeFileSync(join(outDir, name), JSON.stringify(data), "utf8");
  console.log(`${name}: ${data.records.length} records`);
}
