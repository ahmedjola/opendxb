/**
 * Diagnose *why* a Dubai host is unreachable, and find what is.
 *
 * The first probe reported "fetch failed" for every dubaipulse.gov.ae URL
 * while dubailand.gov.ae answered normally. "fetch failed" collapses several
 * very different faults into one message — DNS miss, refused connection,
 * silent drop, TLS rejection — and the difference matters enormously here:
 *
 *   - DNS failure        -> the hostname is wrong
 *   - connection refused -> the host is up but the port is closed
 *   - timeout / no reply  -> traffic is being dropped, which is what
 *                            geo-blocking looks like from outside
 *
 * So this walks the stack one layer at a time and reports the real errno,
 * then crawls the hosts that *do* answer for actual data files.
 */
import { Resolver } from "node:dns/promises";
import { connect } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { writeFileSync } from "node:fs";

const log = (...a) => console.log(...a);

const HOSTS = [
  "www.dubaipulse.gov.ae",
  "dubaipulse.gov.ae",
  "api.dubaipulse.gov.ae",
  "dubailand.gov.ae",
  "gateway.dubailand.gov.ae",
  "data.government.ae",
  "www.dm.gov.ae",
  "www.khda.gov.ae",
  "u.ae",
];

/** Resolve A records using a public resolver, bypassing runner DNS quirks. */
async function dns(host) {
  const resolver = new Resolver({ timeout: 5000, tries: 2 });
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  try {
    return { ok: true, addresses: await resolver.resolve4(host) };
  } catch (error) {
    return { ok: false, error: error.code ?? error.message };
  }
}

/** Raw TCP connect — distinguishes "refused" from "dropped". */
function tcp(host, port = 443, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (result) => { socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done({ ok: true }));
    socket.on("timeout", () => done({ ok: false, error: "TIMEOUT (packets dropped — consistent with geo-blocking)" }));
    socket.on("error", (error) => done({ ok: false, error: error.code ?? error.message }));
  });
}

/** TLS handshake — catches SNI or certificate-level rejection. */
function tls(host, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const socket = tlsConnect({ host, port: 443, servername: host, rejectUnauthorized: false });
    const done = (result) => { socket.destroy(); resolve(result); };
    socket.setTimeout(timeoutMs);
    socket.on("secureConnect", () => done({ ok: true, protocol: socket.getProtocol() }));
    socket.on("timeout", () => done({ ok: false, error: "TIMEOUT" }));
    socket.on("error", (error) => done({ ok: false, error: error.code ?? error.message }));
  });
}

async function http(host) {
  try {
    const response = await fetch(`https://${host}/`, {
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; opendxb-probe/0.1)" },
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: true, status: response.status, server: response.headers.get("server") ?? "?" };
  } catch (error) {
    return { ok: false, error: error.cause?.code ?? error.message };
  }
}

log("LAYER-BY-LAYER REACHABILITY\n");
log(`${"HOST".padEnd(28)}${"DNS".padEnd(20)}${"TCP:443".padEnd(14)}${"TLS".padEnd(12)}HTTP`);
log("─".repeat(92));

const results = {};
for (const host of HOSTS) {
  const d = await dns(host);
  const dnsCell = d.ok ? (d.addresses[0] ?? "resolved") : `FAIL ${d.error}`;
  let t = { ok: false, error: "skipped" }, s = { ok: false, error: "skipped" }, h = { ok: false, error: "skipped" };
  if (d.ok) {
    t = await tcp(host);
    if (t.ok) { s = await tls(host); if (s.ok) h = await http(host); }
  }
  results[host] = { dns: d, tcp: t, tls: s, http: h };
  log(
    host.padEnd(28) +
      dnsCell.slice(0, 18).padEnd(20) +
      (t.ok ? "open" : t.error).slice(0, 12).padEnd(14) +
      (s.ok ? "ok" : s.error).slice(0, 10).padEnd(12) +
      (h.ok ? `${h.status} ${h.server}` : h.error),
  );
}

/** Pages worth crawling for real download links, once we know who answers. */
const CRAWL = [
  "https://dubailand.gov.ae/en/downloads/",
  "https://dubailand.gov.ae/en/open-data/real-estate-data/",
  "https://dubailand.gov.ae/en/open-data/",
  "http://data.government.ae/en_GB/dataset?organization=dubaipulse",
  "https://www.dm.gov.ae/open-data2/",
];

log(`\n\nCRAWLING REACHABLE PAGES FOR DATA FILES\n${"═".repeat(92)}`);
const found = {};

for (const url of CRAWL) {
  log(`\n${url}`);
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; opendxb-probe/0.1)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) { log(`  HTTP ${response.status}`); continue; }
    const html = await response.text();

    const links = new Set();
    const pattern = /(?:href|src|data-href|data-url)\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const href = match[1];
      // Real data files, plus the dataset/download pages that lead to them.
      if (!/\.(csv|xlsx?|json|zip|kml)(\?|$)|\/download|datafile|dataset|open-?data/i.test(href)) continue;
      if (/\.(png|jpe?g|svg|gif|ico|css|js|woff2?)(\?|$)|webmanifest/i.test(href)) continue;
      try { links.add(new URL(href, url).toString()); } catch {}
    }
    const list = [...links].slice(0, 40);
    log(`  ${list.length} candidate link(s):`);
    for (const link of list) log(`    ${link}`);
    found[url] = list;
  } catch (error) {
    log(`  unreachable: ${error.cause?.code ?? error.message}`);
  }
}

writeFileSync("diagnose-report.json", JSON.stringify({ results, found }, null, 2));
log(`\n${"═".repeat(92)}\nReport written to diagnose-report.json`);
