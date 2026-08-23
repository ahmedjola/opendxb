# Architecture

## The shape of the problem

Dubai's open data is published by authority, not by subject. Each authority is internally consistent and mutually incompatible with every other. The interesting questions are all cross-authority, so the value is entirely in the join — and the join is hard for three reasons:

1. **No shared key.** No authority publishes another's identifier. The only thing every dataset carries is a *place name*, in free text.
2. **Place names are unstable.** Official vs. market name, English vs. Arabic, ordinal words vs. digits, casing and punctuation drift across export vintages.
3. **Access friction.** Tokens expire mid-download; exports are full-history rather than deltas; column names change without notice.

The layer is organised around those three, in that order.

```
                    ┌──────────────────────────────────┐
   Dubai Pulse ────►│  sources/    adapters, one per   │
   DLD / KHDA       │              dataset             │
   DHA / RTA        └───────────────┬──────────────────┘
                                    │ raw rows
                                    ▼
                    ┌──────────────────────────────────┐
                    │  geo/        normalise → resolve │  ◄── data/communities.json
                    │              to a canonical slug │      (the crosswalk)
                    └───────────────┬──────────────────┘
                                    │ typed records, keyed by community
                                    ▼
                    ┌──────────────────────────────────┐
                    │  store/      FileStore · Memory  │
                    │              · Sample (readonly) │
                    └───────────────┬──────────────────┘
                                    │
                    ┌───────────────▼──────────────────┐
                    │  client.ts   queries + profile() │
                    └───────┬──────────────┬───────────┘
                            │              │
                     cli/ ──┘              └── mcp/  (AI agents)
```

## `geo/` — the join engine

Everything else is plumbing; this is the part that had to be right.

**`normalize.ts`** folds a name in either script to a comparable key. It is pure and dependency-free so it can be tested exhaustively. Arabic: diacritics, tatweel, hamza seating (`أ إ آ ٱ` → `ا`), alef maqsura, teh marbuta, Arabic-Indic and Extended Arabic-Indic digits, definite article, ordinals. Latin: accents, apostrophes (dropped, not spaced, so `Za'abeel` stays one word), the `Al`/`El` article, ordinal words → digits, and a transliteration variant table.

Arabic and Latin keys deliberately live in the same index without ever colliding: the resolver stores one alias entry per script rather than attempting machine transliteration between them, because transliteration of Gulf place names is not reliable enough to join on.

**`similarity()`** combines fuzzy token alignment (0.6) with character distance over the *sorted* token join (0.4), which makes it order-insensitive by construction. Two hard rules sit on top:

- **Numeric guard.** If both keys carry digits and the digits differ, the score is zero. `Al Barsha 1` and `Al Barsha 2` share every token but one, and that one token is the entire identity of the place.
- **Orphan-token penalty.** A distinctive token with no counterpart above 0.5 on the other side multiplies the score by 0.8. This is what keeps Jumeirah Village *Circle* apart from Jumeirah Village *Triangle*.

**`resolver.ts`** tries exact alias hits first (official names outrank market names on collision), then a fuzzy pass restricted to the query's own script. It returns `match: null` — with candidates attached — whenever the top two are within 0.05 of each other.

The design bias throughout: **prefer a miss to a wrong answer.** A missed join shows up as a gap the caller can see. A confident wrong join silently attributes a school in Al Barsha 2 to Al Barsha 1, and nobody ever notices.

## `sources/` — adapters

An adapter is declarative: an id, an authority, an endpoint, and a `normalize(row)`. Auth, retries, backoff, community resolution and storage all live in the layer, so adding an authority means describing its columns rather than re-solving the plumbing.

Every field is read through `field(row, ...names)`, which accepts a list of every column spelling observed in the wild and falls back to a case-insensitive pass. Exports get renamed; adapters should bend rather than break.

Endpoints are overridable via `OPENDXB_ENDPOINT_<SOURCE_ID>` because Dubai Pulse reorganises dataset paths without notice, and that should not require a package release.

## `auth/` — the token problem

Pulse bearer tokens last about 30 minutes. A full DLD transaction history download takes longer than that, so the naive script dies at 401 partway through — the single most-cited piece of friction in working with Dubai's open data.

`PulseTokenManager` refreshes 5 minutes before nominal expiry and shares one in-flight refresh promise across all concurrent callers, so a parallel ingest triggers exactly one refresh rather than one per worker.

## `store/` — persistence

`Store` is an interface with three implementations: `FileStore` (JSON per source, written via write-then-rename so an interrupted ingest cannot leave truncated-but-parseable JSON), `MemoryStore` (tests), and `SampleStore` (read-only over the bundled synthetic sample; `put()` throws, so sample rows cannot contaminate a real dataset).

The read path is "load once, filter in memory". That is fast enough at present record counts and keeps the dependency graph at two packages. `Store` is an interface precisely so a SQLite or DuckDB backend can replace `FileStore` when full DLD history stops fitting comfortably in memory — that is the expected first scaling change.

## `client.ts` — the payoff

`profile(name)` loads five sources concurrently, filters each to one community, and returns a single object spanning four authorities. Sources that have not been ingested are reported in `missingSources` rather than throwing, so a partial install still returns a useful answer.

Statistics are medians and quartiles, never means: Dubai property values are heavily skewed, and one Palm Jumeirah penthouse would otherwise dominate a community's average.

## Testing

85 tests, weighted toward the join engine because that is where a silent bug is both most likely and most damaging. The resolver suite asserts the refusals explicitly — `JVC ≠ JVT`, `Al Barsha 1 ≠ Al Barsha 2`, unknown places return `null` rather than a nearest guess — so a future "improvement" to the matcher that loosens them fails the build.
