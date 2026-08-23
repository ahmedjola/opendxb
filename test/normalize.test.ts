import { describe, it, expect } from "vitest";
import {
  normalizeName, normalizeArabic, normalizeLatin, similarity, editDistance, isArabic,
} from "../src/geo/normalize.js";

describe("isArabic", () => {
  it("detects Arabic script", () => {
    expect(isArabic("البرشاء")).toBe(true);
    expect(isArabic("Al Barsha")).toBe(false);
    expect(isArabic("Al Barsha البرشاء")).toBe(true);
    expect(isArabic("")).toBe(false);
  });
});

describe("normalizeLatin", () => {
  it("collapses the Arabic definite article however it is written", () => {
    expect(normalizeLatin("Al Barsha")).toBe("barsha");
    expect(normalizeLatin("al-barsha")).toBe("barsha");
    expect(normalizeLatin("AL BARSHA")).toBe("barsha");
    expect(normalizeLatin("El Barsha")).toBe("barsha");
  });

  it("maps English ordinals to digits, which is how DLD and KHDA disagree", () => {
    expect(normalizeLatin("Al Barsha First")).toBe("barsha 1");
    expect(normalizeLatin("Al Barsha 1")).toBe("barsha 1");
    expect(normalizeLatin("Jumeirah Third")).toBe("jumeirah 3");
    expect(normalizeLatin("Umm Suqeim Second")).toBe("umm suqeim 2");
  });

  it("folds transliteration variants of the same Arabic word", () => {
    expect(normalizeLatin("Jumeira 1")).toBe(normalizeLatin("Jumeirah First"));
    expect(normalizeLatin("Um Suqeim")).toBe(normalizeLatin("Umm Suqeim"));
    expect(normalizeLatin("Al Qouz")).toBe(normalizeLatin("Al Quoz"));
    expect(normalizeLatin("Shaikh Zayed")).toBe(normalizeLatin("Sheikh Zayed"));
    expect(normalizeLatin("Mohammad Bin Rashid")).toBe(normalizeLatin("Mohammed Bin Rashid"));
  });

  it("drops apostrophes without splitting the word", () => {
    expect(normalizeLatin("Za'abeel")).toBe("zaabeel");
    expect(normalizeLatin("Me'aisem First")).toBe("meaisem 1");
  });

  it("strips accents and punctuation", () => {
    expect(normalizeLatin("Jumeirah  Village,  Circle")).toBe("jumeirah village circle");
    expect(normalizeLatin("Déira")).toBe("deira");
  });

  it("returns empty for input that is only articles or punctuation", () => {
    expect(normalizeLatin("Al")).toBe("");
    expect(normalizeLatin("---")).toBe("");
  });
});

describe("normalizeArabic", () => {
  it("strips diacritics and tatweel", () => {
    expect(normalizeArabic("البُرْشاء")).toBe(normalizeArabic("البرشاء"));
    expect(normalizeArabic("الـــبرشاء")).toBe(normalizeArabic("البرشاء"));
  });

  it("folds hamza seating, alef maqsura and teh marbuta", () => {
    expect(normalizeArabic("أم سقيم")).toBe(normalizeArabic("ام سقيم"));
    expect(normalizeArabic("جميرى")).toBe(normalizeArabic("جميري"));
    expect(normalizeArabic("الثنية")).toBe(normalizeArabic("الثنيه"));
  });

  it("maps Arabic ordinals to digits so they align with the Latin key shape", () => {
    expect(normalizeArabic("البرشاء الأولى").endsWith(" 1")).toBe(true);
    expect(normalizeArabic("البرشاء الثانية").endsWith(" 2")).toBe(true);
    expect(normalizeArabic("الثنية الخامسة").endsWith(" 5")).toBe(true);
  });

  it("converts Arabic-Indic digits", () => {
    expect(normalizeArabic("وادي الصفا ٥")).toBe(normalizeArabic("وادي الصفا 5"));
    expect(normalizeArabic("وادي الصفا ۵")).toBe(normalizeArabic("وادي الصفا 5"));
  });

  it("does not corrupt an ordinal by stripping its definite article", () => {
    // "الأولى" must become "1", never "اولي" with the article shaved off.
    expect(normalizeArabic("الأولى")).toBe("1");
  });
});

describe("normalizeName", () => {
  it("routes by script", () => {
    expect(normalizeName("Al Barsha First")).toBe("barsha 1");
    expect(normalizeName("البرشاء الأولى")).toContain("1");
  });

  it("is total on junk input", () => {
    expect(normalizeName("")).toBe("");
    // @ts-expect-error exercising the runtime guard
    expect(normalizeName(null)).toBe("");
  });
});

describe("editDistance", () => {
  it("counts a transposition as one operation", () => {
    expect(editDistance("barsha", "brasha")).toBe(1);
  });

  it("handles identity and empties", () => {
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("abc", "")).toBe(3);
  });

  it("bails out past the cap instead of computing the true distance", () => {
    expect(editDistance("aaaaaaaa", "zzzzzzzz", 2)).toBeGreaterThan(2);
  });
});

describe("similarity", () => {
  it("scores identical keys at 1", () => {
    expect(similarity("barsha 1", "barsha 1")).toBe(1);
  });

  it("REFUSES to match different numbered sub-communities", () => {
    // The correctness guarantee the whole layer rests on: Al Barsha 1 and
    // Al Barsha 2 are distinct places and must never fuzzy-match.
    expect(similarity("barsha 1", "barsha 2")).toBe(0);
    expect(similarity("jumeirah 1", "jumeirah 3")).toBe(0);
    expect(similarity("wadi safa 5", "wadi safa 7")).toBe(0);
  });

  it("still tolerates typos within the same numbered community", () => {
    expect(similarity("brasha 1", "barsha 1")).toBeGreaterThan(0.72);
  });

  it("is order-insensitive", () => {
    expect(similarity("village jumeirah circle", "jumeirah village circle")).toBeGreaterThan(0.8);
  });

  it("returns 0 for empty input", () => {
    expect(similarity("", "barsha")).toBe(0);
    expect(similarity("barsha", "")).toBe(0);
  });
});
