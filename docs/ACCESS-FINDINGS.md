# Dubai Pulse access: what we tested and what we found

Recorded because it is the kind of thing every project hitting this data has to
rediscover, and none of it is documented publicly.

All tests were run from GitHub Actions runners (US-based) on 2026-08-23. Full
logs are in the repo's Actions history.

## Reachability, layer by layer

| Host | DNS | TCP:443 | TLS | HTTP |
|---|---|---|---|---|
| `www.dubaipulse.gov.ae` | 91.73.143.12 | **TIMEOUT** | — | — |
| `dubaipulse.gov.ae` | 91.73.143.12 | **TIMEOUT** | — | — |
| `api.dubaipulse.gov.ae` | 91.73.143.16 | open | ok | 200 |
| `dubailand.gov.ae` | 172.66.144.249 | open | ok | 200 (cloudflare) |
| `gateway.dubailand.gov.ae` | 104.20.28.204 | open | ok | 404 (cloudflare) |
| `data.government.ae` | 185.141.13.100 | **TIMEOUT** | — | — |
| `www.dm.gov.ae` | 150.171.109.146 | open | ok | 200 |
| `www.khda.gov.ae` | 91.72.199.209 | open | ok | 302 |

**DNS resolves for every host, including the unreachable ones.** The hostnames
were never wrong. `www.dubaipulse.gov.ae` and `data.government.ae` accept the
DNS query and then silently drop TCP — packets discarded rather than refused,
which is what geo-fencing looks like from outside. Dubai Land Department, Dubai
Municipality and KHDA answer normally from the same runner.

## The API host is not a data API

`api.dubaipulse.gov.ae` is reachable, which initially looked like a way around
the geo-block. It is not.

It serves **webMethods "Integration Server Administrator"** — an internal
integration platform's admin console. Every path probed (`/api`, `/v1`,
`/data`, `/datasets`, `/catalog`, `/swagger`, `/openapi.json`, `/v2/api-docs`,
`/auth/oauth/token`, …) returns `302 -> /`, landing back on that console. No
OpenAPI document, no `WWW-Authenticate` challenge, no discoverable data route.

A 302-to-root for every path means blind discovery cannot work here: the server
gives identical answers for real and imaginary paths, so there is nothing to
distinguish a correct route from a wrong one. Exact paths have to come from
Dubai Pulse's own documentation.

## What this rules in and out

- ❌ **Scraping the portal from CI.** `www.dubaipulse.gov.ae` is unreachable
  from outside the UAE. No amount of code fixes this.
- ❌ **Guessing API routes.** Everything redirects to the same console.
- ❓ **Documented API routes + credentials.** Still untested. If Pulse
  documents a data path on this host, it may work from anywhere. This needs
  someone with portal access (i.e. inside the UAE) to read the docs.
- ✅ **Running from inside the UAE.** A self-hosted runner or small VPS in a
  UAE region (AWS `me-central-1`, Azure UAE North) reaches the portal normally.
- ✅ **DLD, DM and KHDA hosts.** Reachable from anywhere. Their open-data pages
  yielded only navigation links when crawled, so the actual downloads are
  rendered client-side or sit behind a form — worth a headless-browser pass.

## The other authorities: nothing found

The DLD gateway was found by driving a browser and watching what the authority's own
pages fetch. The same method was run against every other reachable authority — KHDA
(home, education directory, ratings, open data), Dubai Municipality (open data, Makani,
GeoHub), RTA open data and dubai.ae — including typing into search inputs and clicking
through tabs, because a directory page fetches nothing until a search actually runs.

**Result: four network calls across nine pages, none of them government data.** One was
a third-party search widget (`api.addsearch.com`), one a vendor licence check
(`mindrockets.co`). Dubai Municipality's GeoHub timed out at 60s. RTA and dubai.ae made
no data calls at all.

So DLD's gateway appears to be unusual rather than typical. The other authorities either
render server-side, sit behind Dubai Pulse, or publish nothing programmatically reachable.

**What this means for a second dataset.** Live ingestion is not available for KHDA the way
it is for DLD. But KHDA school ratings change roughly once a year, so a live feed was never
the right shape: a dated snapshot, committed and versioned, is both achievable and honest.
That is the recommended path, and it needs someone inside the UAE to fetch the file once.

The investigation scripts that established all of the above have been removed now that
their findings are recorded here. They were one-off tools, and keeping them would imply
they are maintained.

## Recommended order

1. Read Dubai Pulse's API documentation from inside the UAE and capture the
   real data endpoints. Cheapest test, and it may resolve everything.
2. If no usable public endpoint exists, host the ingest on a UAE-region runner.
   This is the durable answer regardless: it removes the geo-block permanently
   and keeps the automation unattended.
3. Independently, drive DLD/KHDA/DM download pages with a headless browser.
   Those hosts are reachable from CI, so anything obtainable there needs no
   UAE presence at all.
