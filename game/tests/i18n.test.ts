import { describe, expect, it, afterEach } from 'vitest';
import { ANSWERS } from '../src/content/loader';
import { PATHS, STATUS_IDS } from '../src/site/journey';
import { STRINGS, dirFor, getLang, isLang, readLang, setLang, t } from '../src/site/i18n';

afterEach(() => setLang('en'));

/**
 * The site shows one language at a time. The failure mode that matters is a
 * half-translated page: an Arabic reader hitting an English button, or a key
 * printed raw because nobody added it to the other table.
 */
describe('string tables', () => {
  it('covers every key in both languages', () => {
    const en = Object.keys(STRINGS.en).sort();
    const ar = Object.keys(STRINGS.ar).sort();
    expect(ar, 'Arabic table is missing keys present in English').toEqual(en);
  });

  it('has no empty strings', () => {
    for (const [lang, table] of Object.entries(STRINGS)) {
      for (const [key, value] of Object.entries(table)) {
        expect(value.trim(), `${lang}.${key} is empty`).not.toBe('');
      }
    }
  });

  it('keeps the same placeholders in both languages', () => {
    // A dropped {total} means a sentence that reads "Done 3 of ." in Arabic
    // only — the kind of bug that ships because nobody on the team reads it.
    const holders = (value: string) => (value.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(STRINGS.en)) {
      expect(holders(STRINGS.ar[key] ?? ''), `placeholders differ for "${key}"`).toEqual(
        holders(STRINGS.en[key] ?? ''),
      );
    }
  });

  it('actually differs — no key left as an untranslated copy', () => {
    const shared = Object.keys(STRINGS.en).filter(
      (key) => STRINGS.en[key] === STRINGS.ar[key],
    );
    // The two toggle labels are each written in the OTHER language by design,
    // and there is no other legitimate reason for a shared string.
    expect(shared).toEqual([]);
  });
});

describe('t()', () => {
  it('fills placeholders', () => {
    expect(t('journey.done', { done: 3, total: 9 })).toBe('3 of 9 done');
  });

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    expect(t('journey.done', { done: 3 })).toContain('{total}');
  });

  it('returns the key when it is missing, so the gap is visible on the page', () => {
    expect(t('nope.not.a.key')).toBe('nope.not.a.key');
  });

  it('switches language', () => {
    setLang('ar');
    expect(t('journey.badge.locked')).toBe(STRINGS.ar['journey.badge.locked']);
  });

  it('falls back to English rather than printing a key, if Arabic ever drifts', () => {
    setLang('ar');
    expect(getLang()).toBe('ar');
    expect(t('journey.expand')).not.toBe('journey.expand');
  });
});

describe('direction', () => {
  it('maps Arabic to rtl and English to ltr', () => {
    expect(dirFor('ar')).toBe('rtl');
    expect(dirFor('en')).toBe('ltr');
  });

  it('accepts only the two real languages', () => {
    expect(isLang('en')).toBe(true);
    expect(isLang('ar')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});

describe('readLang', () => {
  it('uses a stored choice', () => {
    expect(readLang({ getItem: () => 'ar' })).toBe('ar');
  });

  it('ignores a corrupt stored value', () => {
    expect(readLang({ getItem: () => 'klingon' })).toBe('en');
  });

  it('survives storage that throws outright', () => {
    // A locked-down browser throws on access rather than returning null.
    expect(() =>
      readLang({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).not.toThrow();
  });
});

describe('content is bilingual too', () => {
  it('gives every answer both languages', () => {
    for (const answer of ANSWERS) {
      expect(answer.questionAr.trim(), `${answer.id} question`).not.toBe('');
      expect(answer.answerAr.trim(), `${answer.id} answer`).not.toBe('');
    }
  });

  it('gives every path and step both languages', () => {
    for (const status of STATUS_IDS) {
      const path = PATHS[status];
      expect(path.labelAr.trim(), `${status} label`).not.toBe('');
      expect(path.introAr.trim(), `${status} intro`).not.toBe('');
      for (const step of path.steps) {
        expect(step.titleAr.trim(), `${status}/${step.id}`).not.toBe('');
      }
    }
  });
});
