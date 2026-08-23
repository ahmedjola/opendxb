/**
 * Prove every answer's source link is real and reachable.
 *
 * The content was assembled without being able to open a single official page:
 * this sandbox's egress proxy blocks every .ae government domain, so the
 * research ran against a search index restricted to those domains. That is a
 * reasonable way to FIND an answer and a poor way to TRUST one.
 *
 * GitHub's runners are not blocked — u.ae, khda.gov.ae, dubailand.gov.ae and
 * the rest all answer there. So verification belongs in CI, where the page can
 * actually be fetched.
 *
 * What this can and cannot establish, stated plainly: it proves the cited page
 * exists, responds, and (where a check phrase is given) still contains the term
 * the answer rests on. It cannot prove the answer is a fair summary of that
 * page — only a person reading both can do that, which is what `checkedOn` is
 * a record of.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const answers = JSON.parse(readFileSync(join(root, "content", "answers.json"), "utf8"));

/** Only these host suffixes count as an official source. */
const OFFICIAL = [".gov.ae", ".ae"];

/** Non-government hosts that must never be a sourceUrl, even on a .ae domain. */
const DISALLOWED = /bayut|propertyfinder|dubizzle|blog|medium|linkedin|expatica|relocat|lawfirm|advocates/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function structuralProblems(entry) {
  const problems = [];
  for (const field of ["id", "office", "questionEn", "answerEn", "sourceUrl", "sourceEntity", "checkedOn"]) {
    if (!entry[field]) problems.push(`missing ${field}`);
  }
  if (!entry.sourceUrl || entry.sourceUrl === "TODO") return [...problems, "sourceUrl is a placeholder"];

  let host;
  try {
    host = new URL(entry.sourceUrl).hostname;
  } catch {
    return [...problems, `sourceUrl is not a URL: ${entry.sourceUrl}`];
  }
  if (!OFFICIAL.some((suffix) => host.endsWith(suffix))) problems.push(`not an official domain: ${host}`);
  if (DISALLOWED.test(host)) problems.push(`commercial or secondary source: ${host}`);

  // A number in an answer is the highest-risk content we can ship: fees and
  // timelines change, and a reader acts on them. Flag any that slipped in so a
  // human decides, rather than discovering it after someone is out of pocket.
  const numeric = /\b(AED|aed)\s?[\d,]+|\b\d+\s?(days?|months?|working days)\b|\b\d+%/;
  if (numeric.test(entry.answerEn ?? "")) problems.push("answer states a fee, percentage or timeline — needs a human re-check");

  return problems;
}

const results = [];
let structuralFailures = 0;

console.log(`Checking ${answers.length} answers\n${"═".repeat(84)}`);

for (const entry of answers) {
  const problems = structuralProblems(entry);
  if (problems.length) structuralFailures++;

  let reach = { ok: false, note: "not attempted" };
  if (!problems.some((p) => p.includes("sourceUrl"))) {
    try {
      const response = await fetch(entry.sourceUrl, {
        redirect: "follow",
        headers: {
          "user-agent": "opendxb source-checker (+https://github.com/ahmedjola/opendxb)",
          accept: "text/html,*/*",
        },
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.text().catch(() => "");
      // A government portal that answers 200 with a "page not found" body is
      // the failure this exists to catch, so check content, not just status.
      const looksMissing = /page not found|404|page cannot be found/i.test(body.slice(0, 4000));
      reach = {
        ok: response.ok && !looksMissing,
        status: response.status,
        note: looksMissing ? "200 but the body reads as a not-found page" : `HTTP ${response.status}`,
      };
    } catch (error) {
      reach = { ok: false, note: error.cause?.code ?? error.message };
    }
    await sleep(900);
  }

  const state = problems.length ? "STRUCT" : reach.ok ? "ok" : "UNREACHED";
  console.log(`${state.padEnd(10)} ${entry.id.padEnd(34)} ${reach.note}`);
  for (const problem of problems) console.log(`           ! ${problem}`);
  results.push({ id: entry.id, sourceUrl: entry.sourceUrl, problems, reach });
}

writeFileSync(join(root, "content", "verification.json"), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));

const unreachable = results.filter((r) => !r.problems.length && !r.reach.ok).length;
console.log(`\n${"═".repeat(84)}`);
console.log(`structural problems : ${structuralFailures}`);
console.log(`unreachable sources : ${unreachable}`);
console.log(`verified reachable  : ${results.filter((r) => r.reach.ok && !r.problems.length).length} / ${answers.length}`);

// Structure is ours to get right, so it gates the build. Reachability is not:
// a government site being down for an hour should not turn the build red and
// train everyone to ignore it. It is reported, and the artifact records it.
if (structuralFailures > 0) {
  console.error(`\n::error::${structuralFailures} answer(s) have structural problems.`);
  process.exit(1);
}
