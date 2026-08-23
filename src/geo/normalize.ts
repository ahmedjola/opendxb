/**
 * Bilingual text normalisation for Dubai place names.
 *
 * Dubai's open data is published by ~30 authorities that never agreed on how to
 * spell anything. The same community appears as:
 *
 *   "Al Barsha First" (DLD)   "AL BARSHA 1" (KHDA)   "al-barsha-1" (a slug)
 *   "البرشاء الأولى" (Arabic)  "Al Barshaa 1" (a typo that shipped)
 *
 * Everything downstream — cross-authority joins, the resolver, the SDK's
 * `community()` entry point — depends on collapsing those into one key.
 * This module is deliberately dependency-free and pure so it can be tested
 * exhaustively; see test/normalize.test.ts.
 */

/** Arabic diacritics (harakat), superscript alef, and Quranic annotation marks. */
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;

/** Tatweel / kashida — a purely typographic stretch character carrying no meaning. */
const TATWEEL = /ـ/g;

/** Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits, in code order 0..9. */
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EXTENDED_ARABIC_INDIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/**
 * Letter folding for Arabic.
 *
 * Dubai's Arabic data is entered by hand across dozens of systems, so hamza
 * seating and teh marbuta are effectively random. We fold aggressively: for
 * place-name matching, losing the distinction between أ and ا costs nothing
 * and gains a great deal of recall.
 */
const ARABIC_LETTER_FOLDING: ReadonlyArray<readonly [RegExp, string]> = [
  [/[آأإٱٲٳ]/g, "ا"], // آ أ إ ٱ ٲ ٳ -> ا
  [/ؤ/g, "و"], // ؤ -> و
  [/ئ/g, "ي"], // ئ -> ي
  [/ى/g, "ي"], // ى -> ي  (alef maqsura -> yeh)
  [/ی/g, "ي"], // ی (Farsi yeh) -> ي
  [/ة/g, "ه"], // ة -> ه  (teh marbuta)
  [/ک/g, "ك"], // ک (Farsi kaf) -> ك
  [/ء/g, ""], // bare hamza -> dropped
];

/**
 * Ordinal words used in Dubai community names, mapped to digits.
 *
 * DLD names sub-communities with English ordinals ("Al Barsha First"), while
 * KHDA, RTA and most listing portals use digits ("Al Barsha 1"). Dubai's
 * official community list only goes as high as "Fifth", but we cover to
 * "Tenth" so the mapping does not quietly fail on future additions.
 */
const ORDINAL_WORDS: Readonly<Record<string, string>> = {
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5",
  sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
};

/** Arabic ordinals, feminine and masculine forms, post-folding. */
const ARABIC_ORDINALS: Readonly<Record<string, string>> = {
  "الاولي": "1", "اولي": "1", "الاول": "1", "اول": "1",
  "الثانيه": "2", "ثانيه": "2", "الثاني": "2", "ثاني": "2",
  "الثالثه": "3", "ثالثه": "3", "الثالث": "3", "ثالث": "3",
  "الرابعه": "4", "رابعه": "4", "الرابع": "4", "رابع": "4",
  "الخامسه": "5", "خامسه": "5", "الخامس": "5", "خامس": "5",
  "السادسه": "6", "سادسه": "6", "السادس": "6", "سادس": "6",
  "السابعه": "7", "سابعه": "7", "السابع": "7", "سابع": "7",
  "الثامنه": "8", "ثامنه": "8", "الثامن": "8", "ثامن": "8",
  "التاسعه": "9", "تاسعه": "9", "التاسع": "9", "تاسع": "9",
  "العاشره": "10", "عاشره": "10", "العاشر": "10", "عاشر": "10",
};

/**
 * Transliteration variants that appear across Dubai datasets for the same
 * Arabic source word. Applied token-wise after basic cleanup.
 *
 * Only genuinely ambiguous transliterations belong here. Adding a pair that is
 * merely *similar* (e.g. "nad" / "nadd" is correct, but "al quoz" / "al qouz"
 * is handled by the vowel rules below) makes false positives more likely.
 */
const TRANSLITERATION_VARIANTS: Readonly<Record<string, string>> = {
  jumeira: "jumeirah", jumairah: "jumeirah", jumeirah: "jumeirah",
  shaikh: "sheikh", shiekh: "sheikh",
  mohammad: "mohammed", muhammad: "mohammed", mohamed: "mohammed",
  um: "umm",
  ben: "bin",
  nadd: "nad",
  zabeel: "zaabeel", zaabeel: "zaabeel", zabel: "zaabeel",
  hebiah: "hebiah", hibiah: "hebiah",
  thanyah: "thanyah", thaniyah: "thanyah",
  marsa: "marsa",
  nakhlat: "nakhlat", nakhlah: "nakhlat",
  qouz: "quoz",
  // Spellings DLD itself uses in its areawise register, which differ from the
  // forms used elsewhere in its own publications. Discovered by reconciling
  // against the live register: without these, "Al Goze First" and "Al Quoz
  // First" are two different places and the registry grows duplicates.
  goze: "quoz",
  muhaisanah: "muhaisnah", muhaisnah: "muhaisnah",
  shiba: "sheba", sheba: "sheba",
  saffa: "safa", safa: "safa",
  jadaf: "jaddaf", jaddaf: "jaddaf",
  thanayah: "thanyah",
  suqaim: "suqeim", suqeim: "suqeim",
  barshaa: "barsha", barsha: "barsha",
  // American vs British spelling; DLD uses both across its systems.
  center: "centre", centre: "centre",
  rega: "rigga", rigga: "rigga",
  murqabat: "muraqqabat", muraqabat: "muraqqabat",
  warsan: "warsan", wersan: "warsan",
  sufouh: "sufouh", safouh: "sufouh",
  buteen: "buteen", butin: "buteen",
  hor: "hor", khor: "hor",
};

/** Tokens that carry no distinguishing information in Dubai place names. */
const STOP_TOKENS: ReadonlySet<string> = new Set(["the", "of", "area", "community"]);

/** Replace Arabic-Indic digits with ASCII equivalents. */
function foldDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const ai = ARABIC_INDIC_DIGITS.indexOf(ch);
    if (ai >= 0) { out += String(ai); continue; }
    const ei = EXTENDED_ARABIC_INDIC_DIGITS.indexOf(ch);
    if (ei >= 0) { out += String(ei); continue; }
    out += ch;
  }
  return out;
}

/** True if the string contains at least one character in the Arabic blocks. */
export function isArabic(input: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(input);
}

/**
 * Fold an Arabic string to a match key: strip diacritics and tatweel, unify
 * hamza/alef/yeh/teh-marbuta, convert digits, drop the definite article, and
 * map ordinals to digits.
 */
export function normalizeArabic(input: string): string {
  let s = input.normalize("NFKC");
  s = s.replace(ARABIC_DIACRITICS, "").replace(TATWEEL, "");
  for (const [pattern, replacement] of ARABIC_LETTER_FOLDING) s = s.replace(pattern, replacement);
  s = foldDigits(s);
  // Arabic comma/semicolon and Latin punctuation alike become separators.
  s = s.replace(/[،؛؟.,;:/\\()[\]{}"'`_-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  const tokens = s.split(" ").filter(Boolean).map((token) => {
    const ordinal = ARABIC_ORDINALS[token];
    if (ordinal) return ordinal;
    // Drop the definite article "ال" only when a stem remains; "ال" alone is
    // never a name, and stripping it from e.g. "الاولي" would corrupt the
    // ordinal lookup that already ran above.
    if (token.length > 3 && token.startsWith("ال")) return token.slice(2);
    return token;
  });

  return tokens.filter(Boolean).join(" ");
}

/**
 * Fold a Latin-script string to a match key: strip accents and punctuation,
 * lowercase, normalise the "Al" article, map ordinal words to digits, and
 * apply the transliteration variant table.
 */
export function normalizeLatin(input: string): string {
  let s = input.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.toLowerCase();
  // Apostrophes mark a glottal stop in transliteration ("Za'abeel") and are
  // dropped rather than spaced, so the word stays whole.
  s = s.replace(/['‘’ʼʻ]/g, "");
  s = s.replace(/[^a-z0-9]+/g, " ").trim();

  const tokens = s.split(" ").filter(Boolean);
  const out: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]!;
    if (STOP_TOKENS.has(token)) continue;
    // "al" is the Arabic definite article; it is written attached, detached,
    // and hyphenated across datasets, and is never distinguishing on its own.
    if (token === "al" || token === "el") continue;
    const ordinal = ORDINAL_WORDS[token];
    if (ordinal) { out.push(ordinal); continue; }
    token = TRANSLITERATION_VARIANTS[token] ?? token;
    out.push(token);
  }

  return out.join(" ");
}

/**
 * Normalise a name in either script to a comparable key.
 *
 * Arabic and Latin keys are intentionally *not* unified — they live in the
 * same index but never collide, because the resolver stores an alias entry per
 * script rather than trying to transliterate between them. Machine
 * transliteration of Gulf place names is not reliable enough to join on.
 */
export function normalizeName(input: string): string {
  if (typeof input !== "string") return "";
  return isArabic(input) ? normalizeArabic(input) : normalizeLatin(input);
}

/** Sorted, de-duplicated token set — the basis for order-insensitive matching. */
export function tokenSet(normalized: string): string[] {
  return [...new Set(normalized.split(" ").filter(Boolean))].sort();
}

/**
 * Damerau-Levenshtein distance, capped for early exit.
 *
 * The cap matters: the resolver compares a query against every alias in the
 * registry, and most comparisons are hopeless. Bailing out once the best
 * possible score exceeds `max` keeps resolution linear in practice.
 */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevPrev: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr: number[] = new Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
      // Transposition: "barsha" vs "brasha" is one operation, not two.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prevPrev[j - 2]! + 1);
      }
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = curr;
    curr = new Array(b.length + 1).fill(0);
  }

  return prev[b.length]!;
}

/** Digit-only tokens within a normalised key, in order. */
function numericTokens(normalized: string): string[] {
  return normalized.split(" ").filter((token) => /^\d+$/.test(token));
}

/** Character-level similarity in [0, 1], derived from capped edit distance. */
export function charSimilarity(a: string, b: string): number {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 1;
  const distance = editDistance(a, b, Math.ceil(longer * 0.6));
  return Math.max(0, 1 - distance / longer);
}

/**
 * Best-partner alignment: every token on each side finds its most similar
 * counterpart on the other, and we average.
 *
 * Plain Jaccard overlap fails here, because it is binary per token — it scores
 * "brasha 1" against "barsha 1" as though the misspelt token were an entirely
 * unrelated word, which is exactly the case a fuzzy matcher exists to handle.
 * Returns both the mean alignment and the worst single token match; the caller
 * needs the latter to detect a distinctive token with no counterpart at all.
 */
function alignTokens(ta: readonly string[], tb: readonly string[]): { mean: number; worst: number } {
  if (ta.length === 0 || tb.length === 0) return { mean: 0, worst: 0 };

  let total = 0;
  let worst = 1;
  let count = 0;

  for (const source of [ta, tb]) {
    const target = source === ta ? tb : ta;
    for (const token of source) {
      let best = 0;
      for (const other of target) {
        const score = token === other ? 1 : charSimilarity(token, other);
        if (score > best) best = score;
        if (best === 1) break;
      }
      total += best;
      if (best < worst) worst = best;
      count++;
    }
  }

  return { mean: total / count, worst };
}

/**
 * Below this, a token is considered to have no counterpart on the other side.
 * "Circle" against "Triangle" lands here, which is the point.
 */
const ORPHAN_TOKEN_FLOOR = 0.5;

/** Multiplier applied when a distinctive token goes unmatched. */
const ORPHAN_PENALTY = 0.8;

/**
 * Similarity in [0, 1] between two normalised place-name keys.
 *
 * Three deliberate properties, each of which a naive implementation gets wrong
 * on real Dubai data:
 *
 * 1. **Order-insensitive.** Scoring runs over sorted token sets, so
 *    "Jumeirah Village Circle" and "Village Circle Jumeirah" are one place.
 * 2. **Typo-tolerant per token.** Alignment is fuzzy at the token level, so a
 *    single transposed letter costs a little, not everything.
 * 3. **Numbers are identity, not detail.** "Al Barsha 1", "Al Barsha 2" and
 *    "Al Barsha 3" are distinct communities kilometres apart. When both sides
 *    carry digits and the digits disagree, the score collapses to zero rather
 *    than degrading gracefully — a missed join is visible and recoverable, a
 *    confident wrong join silently corrupts every downstream number.
 *
 * An unmatched distinctive token (JVC's "Circle" vs JVT's "Triangle") is
 * penalised for the same reason.
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const numA = numericTokens(a);
  const numB = numericTokens(b);
  if (numA.length > 0 && numB.length > 0 && numA.join(",") !== numB.join(",")) return 0;

  const ta = tokenSet(a);
  const tb = tokenSet(b);
  const { mean, worst } = alignTokens(ta, tb);

  // Character comparison runs on the sorted joins so that word order, already
  // discounted by the token alignment, does not sneak back in here.
  const charScore = charSimilarity(ta.join(" "), tb.join(" "));

  const score = mean * 0.6 + charScore * 0.4;
  return worst < ORPHAN_TOKEN_FLOOR ? score * ORPHAN_PENALTY : score;
}
