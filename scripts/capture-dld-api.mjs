/**
 * Capture the full contract of DLD's open-data API.
 *
 * Browser discovery caught the page calling two endpoints on a host we already
 * know is reachable from anywhere:
 *
 *   POST https://gateway.dubailand.gov.ae/dldrest/authentication
 *   POST https://gateway.dubailand.gov.ae/open-data/property-price-idx
 *
 * That matters enormously. dubailand.gov.ae's own pages authenticate against
 * this gateway with no user login, which means the credentials are in the page
 * and the data is genuinely public. If we can replay those two calls, real DLD
 * data becomes available from CI with no Dubai Pulse account and no UAE
 * presence — routing around the geo-block entirely.
 *
 * Knowing the URLs is not enough to replay them; we need the request bodies,
 * the headers, and what comes back. This records all three.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

/** Hosts whose traffic we want the full contract for. */
const OF_INTEREST = /gateway\.dubailand\.gov\.ae|umbraco\/surface|\/open-data\//i;

/** Trim long values so a token or a megabyte of JSON does not flood the log. */
const clip = (text, max = 1500) =>
  typeof text === "string" && text.length > max ? `${text.slice(0, max)}… [+${text.length - max} chars]` : text;

/**
 * Headers that would be sensitive if this were a user session. This auth is
 * anonymous — the page performs it for every visitor — but the values are
 * still truncated rather than printed whole.
 */
const SENSITIVE = /^(authorization|cookie|set-cookie|x-api-key|token)$/i;
function safeHeaders(headers) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key] = SENSITIVE.test(key) ? clip(value, 40) : clip(value, 300);
  }
  return out;
}

const PAGES = [
  "https://dubailand.gov.ae/en/open-data/indexes-home/",
  "https://dubailand.gov.ae/en/open-data/real-estate-data/",
  "https://dubailand.gov.ae/en/open-data/research/",
];

mkdirSync("capture", { recursive: true });
const browser = await chromium.launch();
const captured = [];

for (const pageUrl of PAGES) {
  console.log(`\n${"█".repeat(84)}\nPAGE: ${pageUrl}\n`);
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    viewport: { width: 1440, height: 2400 },
  });
  const page = await context.newPage();

  page.on("requestfinished", async (request) => {
    const url = request.url();
    if (!OF_INTEREST.test(url)) return;
    const record = {
      page: pageUrl,
      method: request.method(),
      url,
      requestHeaders: safeHeaders(request.headers()),
      postData: clip(request.postData() ?? null, 2000),
    };
    try {
      const response = await request.response();
      if (response) {
        record.status = response.status();
        record.responseHeaders = safeHeaders(response.headers());
        // Body may be unavailable for redirects or aborted requests.
        record.body = clip(await response.text().catch(() => "(body unavailable)"), 3000);
      }
    } catch (error) {
      record.responseError = error.message.split("\n")[0];
    }
    captured.push(record);

    console.log(`${"─".repeat(84)}`);
    console.log(`${record.method} ${record.url}  ->  ${record.status ?? "?"}`);
    if (record.postData) console.log(`\nREQUEST BODY:\n${record.postData}`);
    const contentType = record.responseHeaders?.["content-type"] ?? "";
    console.log(`\nRESPONSE [${contentType}]:\n${record.body}\n`);
  });

  try {
    await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    // Index pages load their data on tab/filter interaction, so nudge every
    // control that might trigger a fetch we have not seen yet.
    for (const selector of ["button", "[role=tab]", ".nav-link"]) {
      const elements = await page.$$(selector);
      for (const element of elements.slice(0, 8)) {
        await element.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(700);
      }
    }
    await page.waitForTimeout(4000);
  } catch (error) {
    console.log(`  page error: ${error.message.split("\n")[0]}`);
  }

  await context.close();
}

await browser.close();
writeFileSync("capture/dld-api.json", JSON.stringify(captured, null, 2));
console.log(`\n${"█".repeat(84)}\nCaptured ${captured.length} request/response pairs -> capture/dld-api.json`);
