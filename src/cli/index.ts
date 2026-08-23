#!/usr/bin/env node
import { OpenDXB, defaultDataDir, credentialsFromEnv } from "../client.js";
import { SampleStore } from "../store/sample.js";
import { FileStore } from "../store/file.js";
import { ALL_SOURCES } from "../sources/index.js";
import { OpenDxbError } from "../core/errors.js";

const AED = new Intl.NumberFormat("en-AE", {
  style: "currency", currency: "AED", maximumFractionDigits: 0,
});
const num = (value: number | null): string => (value === null ? "—" : AED.format(value));

function usage(): void {
  console.log(`opendxb — Dubai open data, joined across authorities

USAGE
  opendxb demo                      Explore the bundled synthetic sample
  opendxb resolve <name>            Resolve any spelling to a canonical community
  opendxb profile <name> [--demo]   Cross-authority profile of one community
  opendxb sources                   List available sources and their status
  opendxb ingest <source-id>        Download and normalise a source
  opendxb communities               List the canonical community registry

OPTIONS
  --demo            Read from the bundled synthetic sample instead of ingested data
  --data-dir <dir>  Override the data directory (default ${defaultDataDir()})
  --json            Emit JSON instead of formatted text

AUTHENTICATION
  Sources marked "auth" need Dubai Pulse credentials:
    export DUBAI_PULSE_CLIENT_ID=...
    export DUBAI_PULSE_CLIENT_SECRET=...
  Register at https://www.dubaipulse.gov.ae`);
}

interface Args {
  command: string | undefined;
  rest: string[];
  demo: boolean;
  json: boolean;
  dataDir: string | undefined;
}

function parseArgs(argv: string[]): Args {
  const rest: string[] = [];
  let demo = false;
  let json = false;
  let dataDir: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--demo") demo = true;
    else if (arg === "--json") json = true;
    else if (arg === "--data-dir") { dataDir = argv[++i]; }
    else rest.push(arg);
  }

  return { command: rest.shift(), rest, demo, json, dataDir };
}

function client(args: Args): OpenDXB {
  // `demo` swaps in the read-only sample store, so demo mode can never write
  // synthetic rows into a real dataset.
  const store = args.demo ? new SampleStore() : new FileStore(args.dataDir ?? defaultDataDir());
  const credentials = credentialsFromEnv();
  return new OpenDXB({ store, ...(credentials ? { credentials } : {}) });
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.command || args.command === "help" || args.command === "--help") {
    usage();
    return 0;
  }

  switch (args.command) {
    case "demo":
      return demo({ ...args, demo: true });
    case "resolve":
      return resolve(args);
    case "profile":
      return profile(args);
    case "sources":
      return sources(args);
    case "communities":
      return communities(args);
    case "ingest":
      return ingest(args);
    default:
      console.error(`Unknown command "${args.command}". Run \`opendxb help\`.`);
      return 1;
  }
}

async function resolve(args: Args): Promise<number> {
  const query = args.rest.join(" ");
  if (!query) { console.error("Usage: opendxb resolve <name>"); return 1; }

  const resolution = client(args).resolve(query);
  if (args.json) { console.log(JSON.stringify(resolution, null, 2)); return resolution.match ? 0 : 1; }

  console.log(`Query      ${resolution.query}`);
  console.log(`Normalised ${resolution.normalized}`);
  if (resolution.match) {
    const { community, kind, score, matchedOn } = resolution.match;
    console.log(`\n  ${community.nameEn}  /  ${community.nameAr}`);
    console.log(`  slug    ${community.slug}`);
    console.log(`  match   ${kind} on "${matchedOn}" (score ${score.toFixed(3)})`);
    if (community.marketNames.length) console.log(`  aka     ${community.marketNames.join(", ")}`);
    return 0;
  }

  console.log(resolution.ambiguous ? "\nAmbiguous — refusing to guess." : "\nNo match.");
  for (const candidate of resolution.candidates) {
    console.log(`  ${candidate.community.nameEn} (${candidate.score.toFixed(3)})`);
  }
  return 1;
}

async function profile(args: Args): Promise<number> {
  const query = args.rest.join(" ");
  if (!query) { console.error("Usage: opendxb profile <name> [--demo]"); return 1; }

  const result = await client(args).profile(query);
  if (args.json) { console.log(JSON.stringify(result, null, 2)); return 0; }

  const { community: c, sales, rents, schools, health, transit, marketActivity } = result;
  console.log(`\n${c.nameEn}  /  ${c.nameAr}`);
  if (c.marketNames.length) console.log(`also known as ${c.marketNames.join(", ")}`);
  console.log(`${"─".repeat(56)}`);

  // Shown first because it is the only property data most installations will
  // actually have: the register behind the other blocks needs Dubai Pulse
  // credentials and a UAE IP, this does not.
  const activity = marketActivity.sales;
  if (activity) {
    console.log(`\nMARKET ACTIVITY (DLD gateway)     ${activity.periodFrom} to ${activity.periodTo}`);
    console.log(`  DLD area id       ${activity.areaId}`);
    console.log(`  transactions      ${activity.transactionCount}`);
    console.log(`  total value       ${num(activity.totalWorthAed)}`);
    console.log(`  mean per deal     ${num(activity.meanWorthAed)}`);
    if (activity.firstSaleSharePct !== null) {
      console.log(`  first sales       ${activity.firstSaleSharePct}%   (off-plan / developer)`);
    }
    const mortgages = marketActivity.mortgages;
    if (mortgages) {
      console.log(`  mortgages         ${mortgages.transactionCount} worth ${num(mortgages.totalWorthAed)}`);
    }
  }

  console.log(`\nSALES (DLD register)              ${sales.count} transactions`);
  console.log(`  median            ${num(sales.amountAed.median)}`);
  console.log(`  quartiles         ${num(sales.amountAed.p25)} — ${num(sales.amountAed.p75)}`);
  console.log(`  median AED/sqm    ${num(sales.pricePerSqm.median)}`);
  if (sales.offPlanShare !== null) {
    console.log(`  off-plan share    ${(sales.offPlanShare * 100).toFixed(0)}%`);
  }

  console.log(`\nRENTS (DLD / Ejari)               ${rents.count} contracts`);
  console.log(`  median annual     ${num(rents.annualRentAed.median)}`);
  console.log(`  quartiles         ${num(rents.annualRentAed.p25)} — ${num(rents.annualRentAed.p75)}`);
  if (result.grossYieldPct !== null) {
    console.log(`  gross yield       ${result.grossYieldPct}%   (indicative; excludes service charges)`);
  }

  console.log(`\nSCHOOLS (KHDA)                    ${schools.count}`);
  for (const [rating, count] of Object.entries(schools.byRating)) {
    console.log(`  ${rating.padEnd(18)}${count}`);
  }

  console.log(`\nHEALTH (DHA)                      ${health.count} facilities`);
  for (const [type, count] of Object.entries(health.byType)) {
    console.log(`  ${type.padEnd(18)}${count}`);
  }

  console.log(`\nTRANSIT (RTA)                     ${transit.count} stations`);
  for (const [mode, count] of Object.entries(transit.byMode)) {
    console.log(`  ${mode.padEnd(18)}${count}`);
  }

  console.log(`\n${"─".repeat(56)}`);
  console.log(`joined across ${result.sourcesUsed.length} sources: ${result.sourcesUsed.join(", ")}`);
  if (result.missingSources.length) {
    console.log(`not ingested: ${result.missingSources.join(", ")}`);
  }
  if (args.demo) {
    console.log(`\n⚠  SYNTHETIC SAMPLE DATA — illustrative only, not Dubai registry data.`);
    console.log(`   Run \`opendxb ingest dld.transactions\` with Dubai Pulse credentials for real figures.`);
  }
  return 0;
}

async function sources(args: Args): Promise<number> {
  const dxb = client(args);
  if (args.json) {
    const rows = await Promise.all(ALL_SOURCES.map(async (source) => ({
      id: source.id,
      authority: source.authority,
      title: source.title,
      requiresAuth: source.requiresAuth,
      provenance: await dxb.provenance(source.id),
    })));
    console.log(JSON.stringify(rows, null, 2));
    return 0;
  }

  console.log(`\n${"SOURCE".padEnd(20)}${"AUTH".padEnd(6)}${"STATUS".padEnd(24)}TITLE`);
  console.log("─".repeat(88));
  for (const source of ALL_SOURCES) {
    const meta = await dxb.provenance(source.id);
    const status = meta
      ? `${meta.recordCount} rows, ${meta.ingestedAt.slice(0, 10)}`
      : "not ingested";
    console.log(
      source.id.padEnd(20) +
        (source.requiresAuth ? "yes" : "no").padEnd(6) +
        status.padEnd(24) +
        source.title,
    );
  }
  console.log(`\nCaveats are documented per source in docs/DATA-SOURCES.md.`);
  return 0;
}

async function communities(args: Args): Promise<number> {
  const list = client(args).communities;
  if (args.json) { console.log(JSON.stringify(list, null, 2)); return 0; }
  for (const community of list) {
    const aka = community.marketNames.length ? `  (${community.marketNames.join(", ")})` : "";
    console.log(`${community.slug.padEnd(38)}${community.nameEn}${aka}`);
  }
  console.log(`\n${list.length} communities.`);
  return 0;
}

async function ingest(args: Args): Promise<number> {
  const sourceId = args.rest[0];
  if (!sourceId) {
    console.error(`Usage: opendxb ingest <source-id>\nKnown: ${ALL_SOURCES.map((s) => s.id).join(", ")}`);
    return 1;
  }

  console.error(`Ingesting ${sourceId}…`);
  const report = await client(args).ingest(sourceId);

  if (args.json) { 
    console.log(JSON.stringify({ ...report, unresolvedLocations: Object.fromEntries(report.unresolvedLocations) }, null, 2));
    return 0;
  }

  console.log(`\n${report.sourceId}`);
  console.log(`  fetched   ${report.fetchedRows} rows`);
  console.log(`  stored    ${report.storedRecords} records`);
  console.log(`  skipped   ${report.skippedRows} rows (missing required fields)`);
  console.log(`  took      ${(report.durationMs / 1000).toFixed(1)}s`);

  if (report.unresolvedLocations.size > 0) {
    // This list is the backlog for extending the community registry, so it is
    // surfaced rather than buried — an unresolved location is a join that did
    // not happen.
    const top = [...report.unresolvedLocations.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    console.log(`\n  ${report.unresolvedLocations.size} unresolved locations. Most frequent:`);
    for (const [name, count] of top) console.log(`    ${String(count).padStart(7)}  ${name}`);
    console.log(`\n  Each of these is a missing entry in data/communities.json.`);
    console.log(`  Pull requests adding them are the most useful contribution to this project.`);
  }
  return 0;
}

async function demo(args: Args): Promise<number> {
  console.log(`
opendxb — Dubai open data, joined across authorities
${"═".repeat(56)}

Four Dubai authorities publish data about the same city and none of
them can join to the others. Watch what one name resolves to:
`);

  const dxb = client(args);
  for (const query of ["Dubai Marina", "مرسى دبي", "JVC", "Al Barsha 1", "DIFC", "Dubai Marnia"]) {
    const resolution = dxb.resolve(query);
    const match = resolution.match;
    console.log(
      `  ${query.padEnd(16)} →  ${(match?.community.slug ?? "no match").padEnd(30)} ${match?.kind ?? ""}`,
    );
  }

  console.log(`
All six are the same three places, written the way DLD, KHDA, a
resident, and a typo write them.

Now one community, described across every authority at once:`);

  await profile({ ...args, rest: ["Dubai Marina"] });
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    if (error instanceof OpenDxbError) console.error(`\n${error.message}`);
    else console.error(error);
    process.exit(1);
  });
