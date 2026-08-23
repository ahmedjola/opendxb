# Landing in Dubai

An unofficial guide for people arriving in Dubai — a pixel arrival scene, an onboarding
fork, a dependency-aware path through your first 90 days, and a small walkable city where
each building answers one thing you need to sort out.

Part of [opendxb](../README.md). The data layer lives in the parent repo; this is the
thing people actually use.

## Three ways in, one set of content

| Page | What it is |
|---|---|
| `index.html` | The site — arrival, the fork, your path |
| `game.html` | The Phaser city you walk around |
| `guide.html` | Plain, keyboard-navigable HTML carrying the same answers |

All three render the same `src/content/answers.json`. The game is the delight; the plain
guide is the guarantee — nobody is required to play a game to read a government fact.

## Run it

```bash
npm install
npm run dev      # all three pages
npm test         # 44 tests
npm run build
```

## The rules this thing is built on

**Unofficial, and never ambiguous about it.** An independent community project, not
affiliated with any Dubai government body. Every office is fictional. No government logo,
crest, seal or official colour scheme appears anywhere. The notice is permanent furniture,
not a dismissible banner.

**Every answer cites its source.** Answers come from `answers.json` and are never generated
at runtime. Each carries a `sourceUrl` on an official government domain and the date it was
checked. A test fails the build if any answer lacks one.

**No fees, timelines or document lists.** They change, and a reader acts on them. A test
rejects any answer containing a currency figure, a percentage or a day count. We link to the
official page carrying today's numbers instead.

**Locked steps can still be read.** The dependency locks in the 90-day path gate *doing*,
not *knowing* — a locked step still opens its full sourced answers. Hiding government
information behind a game mechanic would be the wrong trade.

**Progress is yours alone.** `localStorage` only. No account, no sign-up, nothing sent
anywhere. The page renders correctly when storage is empty, blocked, or throws.
