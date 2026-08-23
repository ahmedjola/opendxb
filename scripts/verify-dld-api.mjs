/**
 * Verify DLD's areawise transaction API is usable without a browser.
 *
 * Capture found dubailand.gov.ae's own pages calling, with no user login:
 *
 *   GET /areawise/transaction/sales?fromDate=&toDate=&consumer-id=…
 *   GET /areawise/transaction/mortgage?fromDate=&toDate=&consumer-id=…
 *   POST /dldrest/authentication  {"dateOfBirth":"01/01/01"}  -> Guest profile
 *
 * Both returned 200. The consumer-id is a public key embedded in DLD's public
 * website and handed to every anonymous visitor; the anonymous auth confirms
 * the data is served to guests by design.
 *
 * Two things still need proving before any of it can be relied on:
 *
 *   1. Do the endpoints work from a plain fetch, outside a browser session?
 *      The captured calls carried browser headers and a page referer, and the
 *      gateway may require them.
 *   2. What do the records actually look like? Every adapter in this repo was
 *      written against guessed column names. The real field names are the one
 *      thing that cannot be inferred, and they are in these responses.
 *
 * Requests are sequential and few. This is a public open-data service and
 * should be treated as a shared resource, not hammered.
 */
import { writeFileSync, mkdirSync } from "node:fs";

const GATEWAY = "https://gateway.dubailand.gov.ae";

/**
 * Public API key lifted from DLD's own open-data page, where it is served to
 * every anonymous visitor. Not a credential belonging to anyone.
 */
const CONSUMER_ID = "gkb3WvEG0rY9eilwXC0P2pTz8UzvLj9F";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en",
  // Identifying the caller honestly is the right thing to do against a public
  // government service, and makes us easy to contact if it causes problems.
  "user-agent": "opendxb/0.1 (+https://github.com/ahmedjola/opendxb) open-data client",
  referer: "https://dubailand.gov.ae/",
  origin: "https://dubailand.gov.ae",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, label) {
  const url = `${GATEWAY}${path}${path.includes("?") ? "&" : "?"}consumer-id=${CONSUMER_ID}`;
  try {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(45_000) });
    const text = await response.text();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* not JSON */ }
    return { label, url, status: response.status, parsed, text };
  } catch (error) {
    return { label, url, error: error.cause?.code ?? error.message };
  }
}

/** Pull the record array out of DLD's envelope, whatever it is wrapped in. */
function records(parsed) {
  const result = parsed?.response?.result ?? parsed?.response ?? parsed;
  return Array.isArray(result) ? result : null;
}

mkdirSync("verify", { recursive: true });
const findings = [];

// A range wide enough that an empty result means "no endpoint", not "quiet day".
// The captured calls used a single recent date and came back empty, which is
// exactly the ambiguity to eliminate here.
const RANGES = [
  ["2026-08-01", "2026-08-20"],
  ["2026-07-01", "2026-07-31"],
  ["2026-06-01", "2026-06-30"],
];

console.log("═".repeat(90));
console.log("DLD areawise transaction API — plain fetch, no browser");
console.log("═".repeat(90));

for (const [from, to] of RANGES) {
  for (const kind of ["sales", "mortgage"]) {
    const result = await call(`/areawise/transaction/${kind}?fromDate=${from}&toDate=${to}`, `${kind} ${from}..${to}`);
    const rows = records(result.parsed);
    console.log(
      `\n${result.label.padEnd(30)} HTTP ${result.status ?? result.error}   ` +
        `records: ${rows ? rows.length : "n/a"}`,
    );
    if (rows?.length) {
      console.log(`  FIELD NAMES: ${Object.keys(rows[0]).join(", ")}`);
      console.log(`  SAMPLE: ${JSON.stringify(rows[0]).slice(0, 700)}`);
      findings.push({ ...result, recordCount: rows.length, fields: Object.keys(rows[0]), sample: rows[0] });
      // One good sample per kind is enough to fix the adapters.
      break;
    } else if (result.status === 200) {
      console.log(`  empty envelope: ${result.text.slice(0, 220)}`);
    } else if (result.text) {
      console.log(`  ${result.text.slice(0, 300)}`);
    }
    await sleep(1200);
  }
}

// Other routes the same gateway plausibly exposes. Discovery is cheap here
// because a wrong path returns 404 immediately rather than redirecting.
console.log(`\n${"═".repeat(90)}\nOther gateway routes\n${"═".repeat(90)}`);

const CANDIDATES = [
  "/areawise/transaction/rent?fromDate=2026-07-01&toDate=2026-07-31",
  "/areawise/transaction/gift?fromDate=2026-07-01&toDate=2026-07-31",
  "/areawise/transaction/all?fromDate=2026-07-01&toDate=2026-07-31",
  "/open-data/property-price-idx",
  "/open-data/rental-index",
  "/open-data/transactions",
  "/areawise/areas",
  "/areawise/master-communities",
  "/dldrest/lookups/areas",
];

for (const path of CANDIDATES) {
  const result = await call(path, path);
  const rows = records(result.parsed);
  const summary = rows
    ? `records: ${rows.length}${rows.length ? `  fields: ${Object.keys(rows[0]).slice(0, 12).join(", ")}` : ""}`
    : (result.text ?? "").slice(0, 160).replace(/\s+/g, " ");
  console.log(`${String(result.status ?? result.error).padEnd(6)} ${path.split("?")[0].padEnd(40)} ${summary}`);
  if (rows?.length) findings.push({ ...result, recordCount: rows.length, fields: Object.keys(rows[0]), sample: rows[0] });
  await sleep(1200);
}

writeFileSync("verify/dld-api.json", JSON.stringify(findings, null, 2));
console.log(`\n${"═".repeat(90)}`);
console.log(findings.length ? `✅ ${findings.length} endpoint(s) returned real records.` : "❌ No endpoint returned records.");
