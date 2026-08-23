/**
 * Hunt for open data endpoints at Dubai's other reachable authorities.
 *
 * The DLD gateway was found by watching what dubailand.gov.ae's own pages
 * fetch. That worked because a page rendering a dataset has to get it from
 * somewhere, and that somewhere is callable directly. This repeats the method
 * against KHDA, Dubai Municipality and RTA — all confirmed reachable from
 * outside the UAE (docs/ACCESS-FINDINGS.md), all still unexplored.
 *
 * The prize is a SECOND authority. A crosswalk between government datasets is
 * worth nothing while only one dataset flows through it; with two, questions
 * no Dubai portal can answer become answerable.
 *
 * The earlier sweep reported 0 links and 0 network calls for KHDA, which means
 * the run did not get far enough rather than that nothing is there — so this
 * waits longer, scrolls, and drives the search controls that trigger the
 * fetches in the first place.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const TARGETS = [
  { id: "khda-home", url: "https://www.khda.gov.ae/en" },
  { id: "khda-schools", url: "https://www.khda.gov.ae/en/education-directory" },
  { id: "khda-ratings", url: "https://www.khda.gov.ae/en/schools-ratings" },
  { id: "khda-opendata", url: "https://www.khda.gov.ae/en/open-data" },
  { id: "dm-open-data", url: "https://www.dm.gov.ae/open-data2/" },
  { id: "dm-makani", url: "https://www.dm.gov.ae/open-data/open-data-for-makani/" },
  { id: "dm-geohub", url: "https://geodubai.dm.gov.ae/en/Pages/geohub.aspx" },
  { id: "rta-open-data", url: "https://www.rta.ae/wps/portal/rta/ae/open-data" },
  { id: "dubai-open-data", url: "https://www.dubai.ae/en/open-data" },
];

/** Assets that look data-ish but never are. */
const ASSET = /\.(png|jpe?g|svg|gif|webp|css|js|woff2?|ttf|ico|mp4)(\?|$)|google|gtag|facebook|doubleclick|clarity|userway|hotjar|analytics/i;

/** A request worth recording: a data file, or an API-shaped XHR. */
function interesting(url, type) {
  if (ASSET.test(url)) return false;
  if (/\.(csv|xlsx?|json|geojson|zip|kml)(\?|$)/i.test(url)) return true;
  if (type === "xhr" || type === "fetch") {
    return /api|service|data|dataset|search|list|export|report|odata|rest|query|gateway|surface/i.test(url);
  }
  return false;
}

const clip = (t, n = 1200) => (typeof t === "string" && t.length > n ? `${t.slice(0, n)}… [+${t.length - n}]` : t);

mkdirSync("authorities", { recursive: true });
const browser = await chromium.launch();
const report = {};

for (const target of TARGETS) {
  console.log(`\n${"█".repeat(86)}\n${target.id}  ${target.url}`);
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    viewport: { width: 1440, height: 2200 },
  });
  const page = await context.newPage();

  const calls = new Map();
  page.on("requestfinished", async (request) => {
    const url = request.url();
    if (!interesting(url, request.resourceType())) return;
    const key = `${request.method()} ${url}`;
    if (calls.has(key)) return;
    const record = { method: request.method(), url, postData: clip(request.postData() ?? null, 600) };
    try {
      const response = await request.response();
      if (response) {
        record.status = response.status();
        record.contentType = (response.headers()["content-type"] ?? "").split(";")[0];
        // Only JSON/CSV bodies are worth keeping; an HTML body here is a page,
        // not data, and would drown the report.
        if (/json|csv|text\/plain/i.test(record.contentType)) {
          record.body = clip(await response.text().catch(() => ""), 1800);
        }
      }
    } catch { /* response unavailable — the URL alone is still a lead */ }
    calls.set(key, record);
  });

  const entry = { url: target.url, error: null, calls: [] };
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(2500);

    // Directories and rating tables usually fetch nothing until a search runs,
    // which is why a passive load found nothing here last time.
    for (const selector of ['input[type="search"]', 'input[type="text"]', "select"]) {
      for (const element of (await page.$$(selector)).slice(0, 3)) {
        await element.click({ timeout: 1500 }).catch(() => {});
        await element.type?.("a", { delay: 60 }).catch(() => {});
        await page.keyboard.press("Enter").catch(() => {});
        await page.waitForTimeout(2000);
      }
    }
    for (const element of (await page.$$('button, [role="tab"], .nav-link, a[href="#"]')).slice(0, 10)) {
      await element.click({ timeout: 1200 }).catch(() => {});
      await page.waitForTimeout(900);
    }
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `authorities/${target.id}.png` }).catch(() => {});
  } catch (error) {
    entry.error = error.message.split("\n")[0];
    console.log(`  page error: ${entry.error}`);
  }

  entry.calls = [...calls.values()];
  console.log(`  ${entry.calls.length} candidate data call(s)`);
  for (const call of entry.calls.slice(0, 20)) {
    console.log(`\n  ${call.method} ${call.url}  -> ${call.status ?? "?"}  [${call.contentType ?? "?"}]`);
    if (call.postData) console.log(`    body: ${call.postData}`);
    if (call.body) console.log(`    resp: ${call.body}`);
  }

  report[target.id] = entry;
  await context.close();
}

await browser.close();
writeFileSync("authorities/report.json", JSON.stringify(report, null, 2));
const total = Object.values(report).reduce((n, e) => n + e.calls.length, 0);
console.log(`\n${"█".repeat(86)}\n${total} candidate call(s) across ${TARGETS.length} pages -> authorities/report.json`);
