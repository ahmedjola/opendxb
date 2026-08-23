# Contributing

## The most useful contribution: communities

`data/communities.json` is the crosswalk, and it is incomplete by design — it covers the communities carrying the large majority of Dubai's transactions and population, not the full DLD register.

The backlog writes itself. Run an ingest against real data:

```bash
opendxb ingest dld.transactions
```

and it prints every location string it could not resolve, most frequent first. Each line is a join that did not happen.

To add one:

```json
{
  "slug": "al-barsha-south-second",
  "nameEn": "Al Barsha South Second",
  "nameAr": "البرشاء جنوب الثانية",
  "marketNames": ["Al Barsha South 2"],
  "marketNamesAr": []
}
```

Rules:

- `slug` is permanent. Downstream systems key on it; renaming one is a breaking change.
- `nameEn` / `nameAr` are the **official DLD** names. `marketNames` is what people actually say.
- Do **not** add `communityNumber` or `sectorNumber` by hand. Those are official identifiers and are populated by ingest from Dubai Pulse. This project does not assert an identifier it cannot source.
- Add a resolver test for any name you would have got wrong before your change.

## Adding an authority

Adapters are declarative — see `src/sources/khda.ts` for the shortest complete example.

1. Write the adapter with `csvSource({ ... })`.
2. Read every field through `field(row, ...names)`, listing every column spelling you have seen. Exports get renamed; adapters should bend, not break.
3. Return `null` from `normalize` for rows missing anything the record type requires. A partial row stored is a wrong answer later.
4. Document the caveats. Every source has them, and `docs/DATA-SOURCES.md` is where a user looks before trusting a number.
5. Register it in `src/sources/index.ts`.

## The rules that are not negotiable

The matcher's refusals are load-bearing, and there are tests asserting each one:

- Different numbers are different places. `Al Barsha 1` must never match `Al Barsha 2`.
- Ambiguity is reported, not resolved. If the top two candidates are within the margin, return `null` with candidates.
- Unknown places return `null`, never the nearest thing.

A change that loosens matching to raise the hit rate will fail the build, and that is intended. A missed join is a visible gap; a confident wrong join silently corrupts every number downstream.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
node scripts/generate-sample.mjs   # regenerate the synthetic sample (deterministic)
```

New behaviour needs a test. Bug fixes need a test that fails before the fix.
