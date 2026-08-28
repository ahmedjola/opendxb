# opendxb

**One typed, bilingual, cross-authority data layer for Dubai's open government data.**

SDK · CLI · MCP server — for Node 20+, in TypeScript, MIT licensed.

**Landing in Dubai**, the game and guide built on this layer, is live at [opendxb.io](https://www.opendxb.io) ([game](https://www.opendxb.io/game), [plain guide](https://www.opendxb.io/guide)).

```bash
npx opendxb demo
```

---

## The problem

Dubai publishes an unusual amount of open government data. It publishes it *vertically*:

| Authority | Publishes |
|---|---|
| **DLD** — Land Department | every property transaction, every registered tenancy contract |
| **KHDA** — Knowledge & Human Development | private schools and inspection ratings |
| **DHA** — Health Authority | licensed clinics, hospitals and pharmacies |
| **RTA** — Roads & Transport | metro, tram and bus stations |

Each publishes its own vertical, with its own identifiers, its own column names, and its own spelling of the same place. DLD registers Dubai Marina as **`Marsa Dubai`** — a name essentially nobody in Dubai says out loud. Add an Arabic name for every record, ordinals written as words in one export and digits in another (`Al Barsha First` vs `Al Barsha 1`), casing and punctuation that drift between export vintages, and a bearer token that expires halfway through your download.

So a question like *"what does it cost to live within reach of an Outstanding school?"* — which spans exactly two of those four — requires you to first rebuild the join by hand. Everyone who has tried has rebuilt it privately, badly, and again.

**This package is that join, done once, in the open.**

## What it does

```ts
import { OpenDXB } from "opendxb";

const dxb = new OpenDXB();

// Every one of these resolves to the same canonical community.
dxb.resolve("Dubai Marina");   // alias  → marsa-dubai
dxb.resolve("مرسى دبي");        // exact  → marsa-dubai
dxb.resolve("Marsa Dubai");    // exact  → marsa-dubai
dxb.resolve("Dubai Marnia");   // fuzzy  → marsa-dubai

// Four authorities, one call, one object.
const profile = await dxb.profile("JVC");
profile.sales.amountAed.median;   // DLD
profile.rents.annualRentAed.median; // DLD / Ejari
profile.grossYieldPct;              // derived
profile.schools.byRating;           // KHDA
profile.health.byType;              // DHA
profile.transit.byMode;             // RTA
```

`opendxb profile "Dubai Marina" --demo`:

```
Marsa Dubai  /  مرسى دبي
also known as Dubai Marina
────────────────────────────────────────────────────────

SALES (DLD)                       78 transactions
  median            AED 2,983,000
  quartiles         AED 2,343,250 — AED 4,676,000
  median AED/sqm    AED 21,064
  off-plan share    53%

RENTS (DLD / Ejari)               66 contracts
  median annual     AED 167,500
  gross yield       5.62%   (indicative; excludes service charges)

SCHOOLS (KHDA)                    2
  Outstanding       1
  Very Good         1
...
joined across 5 sources: dld.transactions, dld.rents, khda.schools, dha.facilities, rta.stations
```

## Install

```bash
npm install opendxb        # SDK
npx opendxb demo           # try it with no credentials, no download
```

## Real data, no account, no UAE address

Dubai Pulse — the emirate's open-data portal — **only accepts traffic from inside the UAE**. Its hostname resolves from anywhere and then silently drops the connection, which is why every naive attempt to automate against it fails with an unhelpful `fetch failed`. That rules out CI, and rules out most people outside the country.

There is a way around it. Dubai Land Department's own public pages call a gateway that **is** reachable worldwide, authenticating as `Guest` with no user account:

```
GET https://gateway.dubailand.gov.ae/areawise/transaction/sales?fromDate=…&toDate=…
GET https://gateway.dubailand.gov.ae/areawise/transaction/mortgage?fromDate=…&toDate=…
```

`opendxb ingest dld.areawise-sales` uses it. No credentials, no VPN, no registration:

```
DUBAI, JULY 2026 — 127 areas, live from DLD
  AED 35.30bn across 14,143 transactions, mean AED 2,495,656

  462  Madinat Al Mataar      AED 2.90bn   2457 deals   avg 1.18m   79.1% off-plan
  410  Nakhlat Jumeirah       AED 1.85bn    289 deals   avg 6.41m   60.9% off-plan
  526  Business Bay           AED 1.36bn    440 deals   avg 3.08m   23.0% off-plan
  330  Marsa Dubai            AED 1.15bn    353 deals   avg 3.26m   12.2% off-plan
  375  Jumeirah Second        AED 0.83bn     23 deals   avg 36.01m   4.3% off-plan
```

The trade-off is granularity: this is **totals per area per period**, not one row per registration. Everything the full register offers beyond that still needs Dubai Pulse credentials and a UAE connection. [docs/ACCESS-FINDINGS.md](docs/ACCESS-FINDINGS.md) records exactly what was tested, host by host and layer by layer.

A nightly GitHub Action keeps it fresh and commits per-community aggregates to [`data/profiles/`](data/profiles), so the repo doubles as a versioned public record of Dubai community statistics — something the registries themselves do not publish, since they only ever show current state.

## The hard part: the community crosswalk

The join key is a canonical **community**, and getting a name onto it is most of the work.

`normalizeName()` folds Arabic diacritics, tatweel, hamza seating, alef maqsura, teh marbuta, and Arabic-Indic digits; on the Latin side it strips the definite article however it is written (`Al` / `al-` / `El`), maps ordinal words to digits (`Al Barsha First` → `barsha 1`), and folds transliteration variants (`Jumeira` / `Jumeirah`, `Zabeel` / `Za'abeel`, `Um` / `Umm`).

Matching then runs fuzzy token alignment with two deliberate refusals:

- **Numbers are identity, not detail.** `Al Barsha 1`, `Al Barsha 2` and `Al Barsha 3` are distinct communities kilometres apart. When both sides carry digits and the digits disagree, similarity collapses to zero. A missed join is visible and recoverable; a confident wrong join silently corrupts every number downstream.
- **Ambiguity is reported, never guessed.** If the top two candidates are within 0.05, `match` is `null` and you get the candidate list. `Jumeirah Village Circle` and `Jumeirah Village Triangle` do not collapse into each other.

The crosswalk itself lives in [`data/communities.json`](data/communities.json): **172 communities, 167 carrying Dubai Land Department's own area identifier**, reconciled against DLD's live register by [`scripts/sync-areas.mjs`](scripts/sync-areas.mjs). The mapping from official name to market name is the part no API gives you:

| Official (DLD) | Market name |
|---|---|
| `Marsa Dubai` | Dubai Marina |
| `Al Thanyah Fifth` | Jumeirah Lake Towers / JLT |
| `Al Barsha South Fourth` | Jumeirah Village Circle / JVC |
| `Burj Khalifa` | Downtown Dubai |
| `Trade Centre First` | DIFC |
| `Hadaeq Sheikh Mohammed Bin Rashid` | Dubai Hills Estate |
| `Warsan First` | International City |
| `Madinat Al Mataar` | Dubai South / Expo City |

Reconciling against DLD taught the matcher things no amount of desk work would have: DLD writes `Al Goze` for Al Quoz, `Trade Center` for Trade Centre, `Um Suqaim`, `Al Saffa`, `Al Jadaf`, `Nad Al Shiba`, `Al Thanayah`, `Muhaisanah`, `Al Barshaa`. Each of those was quietly producing a duplicate community until the normaliser learned it.

It also caught a mistake worth keeping in mind: `Palm Deira` scores **0.727** against `Palm Jumeirah`, above the 0.72 threshold. They are different islands. Official identifiers are therefore **never** assigned on a fuzzy match — only on exact or alias hits. A fuzzy match is reported for a human to review and nothing is written.

## Use it from an AI agent

An MCP server ships in the box, so an agent can answer Dubai questions without knowing that DLD calls Dubai Marina "Marsa Dubai":

```json
{
  "mcpServers": {
    "opendxb": {
      "command": "npx",
      "args": ["-y", "opendxb-mcp"],
      "env": { "OPENDXB_SAMPLE": "1" }
    }
  }
}
```

Tools: `dubai_resolve_community`, `dubai_community_profile`, `dubai_property_transactions`, `dubai_schools`, `dubai_list_communities`, `dubai_data_sources`.

Responses always carry their provenance, and sample-backed responses are labelled synthetic in the payload so a model cannot present them as registry data.

## Ingesting the Dubai Pulse sources

Everything beyond the areawise gateway — the full transaction register, Ejari contracts, schools, clinics, transit — needs Dubai Pulse credentials **and a UAE connection**. Note that DLD's API Gateway is provisioned for registered businesses rather than individual developers, so this path is not open to everyone ([register here](https://www.dubaipulse.gov.ae)):

```bash
export DUBAI_PULSE_CLIENT_ID=...
export DUBAI_PULSE_CLIENT_SECRET=...

opendxb ingest dld.transactions
opendxb ingest khda.schools
opendxb profile "Dubai Hills Estate"
```

Pulse bearer tokens expire after about 30 minutes — shorter than a full DLD history download, which is why a straightforward script dies at 401 partway through. `PulseTokenManager` refreshes proactively and shares one in-flight refresh across concurrent workers.

Ingest reports every location it could **not** resolve, most frequent first. That list is the backlog for extending the crosswalk, and PRs against it are the single most useful contribution to this project.

## Honest limitations

Read these before trusting a number.

- **The bundled sample is synthetic.** It is generated by [`scripts/generate-sample.mjs`](scripts/generate-sample.mjs) from a seeded PRNG so it is byte-stable, every record carries `synthetic: true`, and `SampleStore` refuses writes. It exists so the first five minutes work without credentials. It is not Dubai data and must never be quoted as such.
- **Endpoint URLs need verifying.** Dubai Pulse reorganises dataset paths without notice. The resource URLs in this package are the best known at time of writing, not a contract; every one is overridable via `OPENDXB_ENDPOINT_<SOURCE_ID>`. See [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).
- **Community numbers come from DLD or stay null.** 167 of 172 carry DLD's own `areaId`, read from its register. The other five — Al Quoz Second, Al Qusais First, Al Sabkha, Dubai Silicon Oasis, Hatta — recorded no transactions in the months sampled, so nothing was invented for them and their identifiers are explicitly `null`.
- **`dld.areawise-*` is aggregate, not row-level.** Totals per area per period. It cannot answer questions about individual properties or unit sizes.
- **Dubai Pulse sources will fail outside the UAE.** `dld.transactions`, `dld.rents`, `khda.schools`, `dha.facilities` and `rta.stations` all depend on a geo-fenced portal. The nightly workflow attempts them only when credentials are present and never fails the build on them.
- **`grossYieldPct` is indicative only.** Median rent over median sale price across all unit sizes; it ignores service charges, vacancy and transaction costs, and mixes studios with penthouses. A signal, not a valuation.
- **Registry data has its own biases.** Ejari registration compliance is imperfect, so contracts understate the low end of the rental market. DLD amounts are the registered consideration, which for related-party and portfolio transfers is not the economic price. Per-source caveats are in [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) and surfaced by `opendxb sources`.

## The thing people actually use

The data layer is the foundation; [`game/`](game) is what a person opens. **Landing in
Dubai** — an unofficial guide for people arriving here: a pixel arrival scene, an
onboarding fork (visiting / moving / already resident), and a dependency-aware path
through your first 90 days.

The dependency locking is the idea worth stealing. Those errands are not independent — you
cannot open a bank account without an Emirates ID, cannot connect DEWA without Ejari,
cannot register a tenancy without a visa. People lose weeks discovering that one queue at
a time. Showing what blocks what is worth more than any single answer.

Same content renders three ways: the site, a walkable Phaser city, and a plain
keyboard-navigable page. Nobody is required to play a game to read a government fact.

```bash
cd game && npm install && npm run dev
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — how the layer is put together and why
- [Data sources](docs/DATA-SOURCES.md) — every source, its licence, and its caveats
- [Contributing](docs/CONTRIBUTING.md) — especially: adding communities and authorities

## Development

```bash
npm install
npm test          # 105 tests
npm run typecheck
npm run build
node scripts/generate-sample.mjs   # regenerate the synthetic sample
```

## Licence

MIT. Dubai open data itself is published by its respective authorities under the Dubai Open Data Licence (Dubai Data Law No. 26 of 2015); this package does not redistribute it.
