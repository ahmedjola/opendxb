/**
 * Endpoint probe.
 *
 * The dataset URLs compiled into this package were written without network
 * access to Dubai Pulse, so they are guesses. This script runs inside GitHub
 * Actions — which *can* reach dubaipulse.gov.ae — and reports, per source:
 * whether the URL resolves, what content type comes back, and the actual CSV
 * header line.
 *
 * That header line is the thing we cannot guess. Once it is known, the
 * adapters can be corrected to match reality instead of assumption.
 *
 * Nothing here fails the build: a probe that reports "this URL is wrong" has
 * done its job. Exit code is always 0 unless the script itself breaks.
 */
import { writeFileSync } from "node:fs";

const CLIENT_ID = process.env.DUBAI_PULSE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.DUBAI_PULSE_CLIENT_SECRET ?? "";

/**
 * Candidate URLs per source, most likely first.
 *
 * Dubai Pulse has used several URL shapes over the years and the dataset
 * slugs are not documented outside the portal, so each source lists every
 * plausible form rather than betting on one.
 */
const CANDIDATES = {
  "dld.transactions": [
    "https://www.dubaipulse.gov.ae/dataset/dld_transactions-open/resource/transactions.csv",
    "https://www.dubaipulse.gov.ae/dataset/dld-transactions/resource/dld_transactions-open.csv",
    "https://gateway.dubailand.gov.ae/open-data/transactions",
  ],
  "dld.rents": [
    "https://www.dubaipulse.gov.ae/dataset/dld_rent_contracts-open/resource/rent_contracts.csv",
    "https://www.dubaipulse.gov.ae/dataset/dld-rent-contracts/resource/dld_rent_contracts-open.csv",
    "https://gateway.dubailand.gov.ae/open-data/rent-contracts",
  ],
  "khda.schools": [
    "https://www.dubaipulse.gov.ae/dataset/khda-private-schools/resource/schools.csv",
    "https://www.dubaipulse.gov.ae/dataset/khda_private_schools-open/resource/schools.csv",
  ],
  "dha.facilities": [
    "https://www.dubaipulse.gov.ae/dataset/dha-health-facilities/resource/facilities.csv",
    "https://www.dubaipulse.gov.ae/dataset/dha_facilities-open/resource/facilities.csv",
  ],
  "rta.stations": [
    "https://www.dubaipulse.gov.ae/dataset/rta-transport-stations/resource/stations.csv",
    "https://www.dubaipulse.gov.ae/dataset/rta_stations-open/resource/stations.csv",
  ],
};

/** Token endpoints Pulse has been documented as using. */
const TOKEN_URLS = [
  "https://api.dubaipulse.gov.ae/auth/oauth/token",
  "https://www.dubaipulse.gov.ae/auth/oauth/token",
];

const log = (...args) => console.log(...args);

async function getToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    log("No credentials in environment — probing anonymous endpoints only.\n");
    return null;
  }
  for (const url of TOKEN_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await response.text();
      if (!response.ok) {
        log(`  token ${url} -> HTTP ${response.status}: ${text.slice(0, 200)}`);
        continue;
      }
      const token = JSON.parse(text).access_token;
      if (token) {
        log(`✅ Got an access token from ${url}\n`);
        return token;
      }
      log(`  token ${url} -> 200 but no access_token: ${text.slice(0, 200)}`);
    } catch (error) {
      log(`  token ${url} -> ${error.message}`);
    }
  }
  log("⚠️  Could not obtain a token. Auth-only datasets will fail below.\n");
  return null;
}

/**
 * Fetch only the first slice of a dataset.
 *
 * These exports run to hundreds of megabytes; a Range request gets the header
 * line without pulling the whole file. Servers that ignore Range are handled
 * by aborting the stream once enough bytes have arrived.
 */
async function peek(url, token) {
  const headers = { accept: "text/csv,*/*", range: "bytes=0-16383" };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(60_000) });
  const contentType = response.headers.get("content-type") ?? "unknown";
  const contentLength = response.headers.get("content-length") ?? "unknown";

  if (!response.ok && response.status !== 206) {
    const body = await response.text().catch(() => "");
    return { ok: false, status: response.status, contentType, body: body.slice(0, 300) };
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (received < 16384) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
  }
  await reader.cancel().catch(() => {});

  const text = new TextDecoder("utf-8").decode(
    chunks.reduce((acc, c) => { const m = new Uint8Array(acc.length + c.length); m.set(acc); m.set(c, acc.length); return m; }, new Uint8Array()),
  );
  const lines = text.split(/\r?\n/);
  return {
    ok: true,
    status: response.status,
    contentType,
    contentLength,
    header: lines[0] ?? "",
    sample: lines[1] ?? "",
  };
}

const report = [];
const token = await getToken();

for (const [sourceId, urls] of Object.entries(CANDIDATES)) {
  log(`\n${"─".repeat(70)}\n${sourceId}`);
  let found = false;
  for (const url of urls) {
    let result;
    try {
      result = await peek(url, token);
    } catch (error) {
      log(`  ❌ ${url}\n     ${error.message}`);
      continue;
    }
    if (!result.ok) {
      log(`  ❌ HTTP ${result.status}  ${url}`);
      if (result.body) log(`     ${result.body.replace(/\s+/g, " ").slice(0, 160)}`);
      continue;
    }
    // An HTML body means the portal served a login or landing page, not data.
    if (result.contentType.includes("html")) {
      log(`  ⚠️  HTML (login or landing page, not data)  ${url}`);
      continue;
    }
    log(`  ✅ WORKS  ${url}`);
    log(`     type: ${result.contentType}  size: ${result.contentLength}`);
    log(`\n     COLUMNS:\n     ${result.header}`);
    log(`\n     FIRST ROW:\n     ${result.sample}\n`);
    report.push({ sourceId, url, ...result });
    found = true;
    break;
  }
  if (!found) {
    log(`  → No working URL found for ${sourceId}.`);
    report.push({ sourceId, url: null, ok: false });
  }
}

writeFileSync("probe-report.json", JSON.stringify(report, null, 2));
log(`\n${"═".repeat(70)}`);
log(`${report.filter((r) => r.ok).length} of ${Object.keys(CANDIDATES).length} sources reachable.`);
log(`Full report written to probe-report.json (downloadable from this run's artifacts).`);
