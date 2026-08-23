/**
 * Find the real download URLs on Dubai's reachable open-data sites.
 *
 * Plain HTTP crawling of DLD's open-data pages returned navigation links and
 * nothing else, which means the dataset lists are rendered client-side. So this
 * drives a real browser and does two things a fetch cannot:
 *
 *   1. Reads the DOM *after* JavaScript has populated it.
 *   2. Records every network request the page itself makes.
 *
 * The second is the valuable half. A page that renders a dataset table has to
 * fetch that table from somewhere, and that somewhere is an endpoint we can
 * call directly — far more durable than scraping rendered HTML, and it is not
 * discoverable any other way.
 *
 * Runs in GitHub Actions, where dubailand.gov.ae, dm.gov.ae and khda.gov.ae are
 * all reachable (unlike dubaipulse.gov.ae — see docs/ACCESS-FINDINGS.md).
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";

const TARGETS = [
  { id: "dld-real-estate", url: "https://dubailand.gov.ae/en/open-data/real-estate-data/" },
  { id: "dld-downloads", url: "https://dubailand.gov.ae/en/downloads/" },
  { id: "dld-indexes", url: "https://dubailand.gov.ae/en/open-data/indexes-home/" },
  { id: "dld-research", url: "https://dubailand.gov.ae/en/open-data/research/" },
  { id: "dm-open-data", url: "https://www.dm.gov.ae/open-data2/" },
  { id: "khda-home", url: "https://www.khda.gov.ae/en/" },
  { id: "khda-open-data", url: "https://www.khda.gov.ae/en/open-data" },
];

/** File extensions that are actual data rather than page furniture. */
const DATA_FILE = /\.(csv|xlsx?|json|zip|kml|geojson|pdf)(\?|$)/i;

/** Assets that match "data-ish" patterns but never are. */
const ASSET = /\.(png|jpe?g|svg|gif|ico|css|js|woff2?|ttf|mp4)(\?|$)|webmanifest|google|gtag|facebook|doubleclick/i;

/** Requests worth recording: data files, or API-shaped XHR calls. */
function isInteresting(url, resourceType) {
  if (ASSET.test(url)) return false;
  if (DATA_FILE.test(url)) return true;
  if (resourceType === "xhr" || resourceType === "fetch") {
    return /api|service|data|dataset|download|report|export|json|odata|rest/i.test(url);
  }
  return false;
}

mkdirSync("discovery", { recursive: true });

const browser = await chromium.launch();
const report = {};

for (const target of TARGETS) {
  console.log(`\n${"═".repeat(84)}\n${target.id}  ${target.url}`);

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    viewport: { width: 1440, height: 2000 },
  });
  const page = await context.newPage();

  // Every request the page makes, filtered to the ones that could be data.
  const requests = new Set();
  page.on("request", (request) => {
    const url = request.url();
    if (isInteresting(url, request.resourceType())) {
      requests.add(`${request.method()} ${url}`);
    }
  });
  // Responses matter too: a redirect chain can land on a file the request
  // list records only by its original URL.
  page.on("response", (response) => {
    const url = response.url();
    const type = response.headers()["content-type"] ?? "";
    if (DATA_FILE.test(url) || /csv|excel|spreadsheet|zip|octet-stream/i.test(type)) {
      requests.add(`RESPONSE ${response.status()} ${url}  [${type.split(";")[0]}]`);
    }
  });

  const entry = { url: target.url, error: null, links: [], networkCalls: [], tables: [] };

  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Client-rendered lists arrive after load; wait for the network to settle,
    // but do not fail the target if it never fully idles (analytics beacons
    // and chat widgets can poll forever).
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    // Lazy-loaded tables often need a scroll to render.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await page.waitForTimeout(3000);

    entry.links = await page.evaluate(() => {
      const out = new Set();
      for (const anchor of document.querySelectorAll("a[href], [data-href], [data-url], [data-file]")) {
        const href =
          anchor.getAttribute("href") ??
          anchor.getAttribute("data-href") ??
          anchor.getAttribute("data-url") ??
          anchor.getAttribute("data-file");
        if (!href) continue;
        const label = (anchor.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
        out.add(JSON.stringify({ href: new URL(href, location.href).toString(), label }));
      }
      return [...out];
    });
    entry.links = entry.links
      .map((item) => JSON.parse(item))
      .filter((link) => DATA_FILE.test(link.href) || /download|dataset|open-?data|export|report/i.test(link.href))
      .filter((link) => !ASSET.test(link.href));

    // Dataset listings are usually tables; their text names the datasets even
    // when the download itself is wired up through script.
    entry.tables = await page.evaluate(() =>
      [...document.querySelectorAll("table")]
        .slice(0, 5)
        .map((table) => (table.innerText ?? "").trim().replace(/\n{2,}/g, "\n").slice(0, 1500))
        .filter(Boolean),
    );

    await page.screenshot({ path: `discovery/${target.id}.png`, fullPage: false });
  } catch (error) {
    entry.error = error.message.split("\n")[0];
    console.log(`  ERROR: ${entry.error}`);
  }

  entry.networkCalls = [...requests];

  console.log(`  links: ${entry.links.length}   network calls: ${entry.networkCalls.length}   tables: ${entry.tables.length}`);
  for (const link of entry.links.slice(0, 30)) console.log(`    LINK  ${link.href}   ${link.label ? `(${link.label})` : ""}`);
  for (const call of entry.networkCalls.slice(0, 30)) console.log(`    NET   ${call}`);
  for (const table of entry.tables) console.log(`    TABLE\n${table.split("\n").slice(0, 20).map((l) => `      ${l}`).join("\n")}`);

  report[target.id] = entry;
  await context.close();
}

await browser.close();
writeFileSync("discovery/report.json", JSON.stringify(report, null, 2));

const totalLinks = Object.values(report).reduce((n, e) => n + e.links.length, 0);
const totalCalls = Object.values(report).reduce((n, e) => n + e.networkCalls.length, 0);
console.log(`\n${"═".repeat(84)}\n${totalLinks} data link(s), ${totalCalls} network call(s) across ${TARGETS.length} pages.`);
console.log("Screenshots and report.json are in this run's artifacts.");
