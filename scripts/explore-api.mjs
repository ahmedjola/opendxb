/**
 * Explore api.dubaipulse.gov.ae.
 *
 * The reachability diagnostic turned up something worth chasing. Dubai Pulse's
 * two hosts behave completely differently from a US runner:
 *
 *   www.dubaipulse.gov.ae  91.73.143.12  DNS ok -> TCP TIMEOUT   (dropped)
 *   api.dubaipulse.gov.ae  91.73.143.16  DNS ok -> TCP open -> HTTP 200
 *
 * DNS resolves for both, so the hostname was never wrong; the web portal is
 * simply firewalled from outside the UAE while the API host is not. That means
 * automated ingest from GitHub is viable after all — through the API, never
 * through the portal.
 *
 * What is missing is the API's shape: its base paths, whether it publishes a
 * spec, and what it says to an unauthenticated caller. This asks it.
 */
import { writeFileSync } from "node:fs";

const BASE = "https://api.dubaipulse.gov.ae";
const UA = "Mozilla/5.0 (compatible; opendxb-probe/0.1; +https://github.com/ahmedjola/opendxb)";

/** Paths worth asking about: specs first, then plausible data roots. */
const PATHS = [
  "/",
  "/swagger", "/swagger-ui.html", "/swagger.json", "/v2/api-docs",
  "/openapi.json", "/openapi.yaml", "/api-docs", "/docs",
  "/api", "/api/v1", "/v1", "/v2",
  "/data", "/datasets", "/dataset", "/catalog",
  "/health", "/status", "/actuator/health",
  "/open", "/opendata", "/open-data",
  "/auth", "/auth/oauth/token",
];

const results = [];

/**
 * A body is worth showing when it is not an HTML error page. Even a 401 or 403
 * is informative here: it proves the path exists and tells us which auth scheme
 * the gateway expects.
 */
function summarise(contentType, body) {
  const trimmed = body.trim();
  if (!trimmed) return "(empty)";
  if (contentType.includes("html")) {
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(trimmed);
    return `HTML${title ? ` — title: ${title[1].trim()}` : ""}`;
  }
  return trimmed.slice(0, 400).replace(/\s+/g, " ");
}

console.log(`Probing ${BASE}\n${"═".repeat(88)}`);
console.log(`${"PATH".padEnd(24)}${"STATUS".padEnd(10)}${"TYPE".padEnd(28)}BODY`);
console.log("─".repeat(88));

for (const path of PATHS) {
  const url = `${BASE}${path}`;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json,text/plain,*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    const contentType = response.headers.get("content-type") ?? "?";
    const body = await response.text().catch(() => "");
    const location = response.headers.get("location");

    console.log(
      path.padEnd(24) +
        String(response.status).padEnd(10) +
        contentType.split(";")[0].slice(0, 26).padEnd(28) +
        (location ? `-> ${location}` : summarise(contentType, body).slice(0, 300)),
    );

    // WWW-Authenticate names the exact auth scheme the gateway wants, which is
    // more reliable than guessing at OAuth flows.
    const challenge = response.headers.get("www-authenticate");
    if (challenge) console.log(`${" ".repeat(24)}WWW-Authenticate: ${challenge}`);

    results.push({ path, status: response.status, contentType, location, body: body.slice(0, 2000) });
  } catch (error) {
    console.log(path.padEnd(24) + "ERROR".padEnd(10) + (error.cause?.code ?? error.message));
    results.push({ path, error: error.cause?.code ?? error.message });
  }
}

// A token request without credentials still reveals the expected grant shape.
console.log(`\n${"═".repeat(88)}\nUnauthenticated token request (to read the error contract)\n`);
for (const tokenPath of ["/auth/oauth/token", "/oauth/token", "/token"]) {
  try {
    const response = await fetch(`${BASE}${tokenPath}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text().catch(() => "");
    console.log(`POST ${tokenPath} -> ${response.status}: ${body.slice(0, 300).replace(/\s+/g, " ")}`);
    results.push({ path: `POST ${tokenPath}`, status: response.status, body: body.slice(0, 1000) });
  } catch (error) {
    console.log(`POST ${tokenPath} -> ${error.cause?.code ?? error.message}`);
  }
}

writeFileSync("api-report.json", JSON.stringify(results, null, 2));
console.log(`\nReport written to api-report.json`);
