import { describe, expect, it } from 'vitest';
import rawAnswers from '../src/content/answers.json';
import {
  ANSWERS,
  ContentValidationError,
  DISCLAIMER,
  OFFICES,
  findAnswerIssues,
  getAnswerById,
  getAnswersForOffice,
  hasRealSource,
  loadAnswers,
  officeIndex,
  validateAnswer,
} from '../src/content/loader';
import { PLACEHOLDER_MARKER, REQUIRED_ANSWER_FIELDS } from '../src/content/types';

const VALID = {
  id: 'sample-entry',
  office: 'residency-desk',
  questionEn: 'A question?',
  questionAr: 'سؤال؟',
  answerEn: 'An answer.',
  answerAr: 'إجابة.',
  sourceUrl: 'https://example.org/page',
  sourceEntity: 'Example Publisher',
  checkedOn: '2026-08-23',
};

describe('content loader validation', () => {
  it('accepts an entry that has every required field', () => {
    expect(validateAnswer(VALID)).toEqual(VALID);
    expect(findAnswerIssues(VALID)).toEqual([]);
  });

  it('rejects an entry that is missing sourceUrl', () => {
    const { sourceUrl: _omitted, ...withoutSource } = VALID;
    expect(() => validateAnswer(withoutSource)).toThrow(ContentValidationError);
    expect(findAnswerIssues(withoutSource).join(' ')).toContain('sourceUrl');
    expect(() => loadAnswers([withoutSource])).toThrow(/sourceUrl/);
  });

  it('rejects an entry whose sourceUrl is present but empty', () => {
    expect(() => validateAnswer({ ...VALID, sourceUrl: '   ' })).toThrow(/must not be empty/);
  });

  it('rejects an entry missing any other required field', () => {
    for (const field of REQUIRED_ANSWER_FIELDS) {
      const broken: Record<string, unknown> = { ...VALID };
      delete broken[field];
      expect(() => validateAnswer(broken), `missing ${field} should fail`).toThrow(
        ContentValidationError,
      );
    }
  });

  it('rejects non-string fields and bad dates', () => {
    expect(() => validateAnswer({ ...VALID, questionEn: 42 })).toThrow(/must be a string/);
    expect(() => validateAnswer({ ...VALID, checkedOn: '23-08-2026' })).toThrow(/ISO date/);
  });

  it('rejects duplicate ids and unknown offices', () => {
    expect(() => loadAnswers([VALID, VALID])).toThrow(/duplicate id/);
    expect(() => loadAnswers([{ ...VALID, office: 'not-a-real-office' }])).toThrow(
      /unknown office/,
    );
  });

  it('rejects content that is not an array', () => {
    expect(() => loadAnswers({ nope: true })).toThrow(ContentValidationError);
  });
});

describe('shipped content', () => {
  it('loads answers.json without validation errors', () => {
    expect(() => loadAnswers(rawAnswers)).not.toThrow();
    expect(ANSWERS.length).toBeGreaterThan(0);
  });

  it('has no answer with an empty answerEn', () => {
    for (const answer of ANSWERS) {
      expect(answer.answerEn, `answer "${answer.id}" must have English text`).toBeTruthy();
      expect(answer.answerEn.trim().length, `answer "${answer.id}" answerEn is blank`).toBeGreaterThan(0);
    }
  });

  it('has no answer with an empty question, Arabic text, source or checked date', () => {
    for (const answer of ANSWERS) {
      expect(answer.questionEn.trim()).not.toBe('');
      expect(answer.questionAr.trim()).not.toBe('');
      expect(answer.answerAr.trim()).not.toBe('');
      expect(answer.sourceUrl.trim()).not.toBe('');
      expect(answer.sourceEntity.trim()).not.toBe('');
      expect(answer.checkedOn.trim()).not.toBe('');
    }
  });

  it('cites a real official source for every answer', () => {
    // This replaces an earlier assertion that everything WAS a placeholder,
    // which was true only while real content was being sourced. The rule it
    // was protecting has not changed: nothing ships claiming to inform a
    // resident unless it points at the official page it came from.
    for (const answer of ANSWERS) {
      expect(hasRealSource(answer), `"${answer.id}" has no real source`).toBe(true);
      expect(answer.sourceUrl.startsWith('https://'), `"${answer.id}" source is not https`).toBe(true);
      const host = new URL(answer.sourceUrl).hostname;
      expect(host.endsWith('.ae'), `"${answer.id}" cites ${host}, not a UAE government domain`).toBe(true);
    }
  });

  it('has no placeholder text left anywhere', () => {
    for (const answer of ANSWERS) {
      expect(answer.answerEn, `"${answer.id}" still contains placeholder text`).not.toContain(PLACEHOLDER_MARKER);
      expect(answer.sourceUrl, `"${answer.id}" still has a TODO source`).not.toBe('TODO');
    }
  });

  it('states no fee, percentage or timeline without a human re-check', () => {
    // The highest-risk thing this project can publish. A reader acts on a
    // number, and government fees change quietly. The researcher withheld
    // every figure it could not confirm; this keeps it that way.
    const numeric = /\b(AED|aed)\s?[\d,]+|\b\d+\s?(days?|months?|working days)\b|\b\d+%/;
    for (const answer of ANSWERS) {
      expect(numeric.test(answer.answerEn), `"${answer.id}" states a figure — needs verifying`).toBe(false);
    }
  });

  it('states the disclaimer verbatim', () => {
    expect(DISCLAIMER).toBe('Unofficial guide — always confirm with the official source.');
  });
});

describe('office and answer lookup', () => {
  it('finds the answers belonging to an office', () => {
    const residency = getAnswersForOffice('residency-desk');
    expect(residency.length).toBeGreaterThan(0);
    for (const answer of residency) expect(answer.office).toBe('residency-desk');
    expect(getAnswersForOffice('no-such-office')).toEqual([]);
  });

  it('gives every office at least one answer', () => {
    // An office a player can walk into and find empty is a dead end, and reads
    // as broken rather than as unfinished.
    for (const office of OFFICES) {
      expect(getAnswersForOffice(office.id).length, `office "${office.id}" has no answers`).toBeGreaterThan(0);
    }
  });

  it('finds an answer by id', () => {
    const first = ANSWERS[0]!;
    expect(getAnswerById(first.id)?.office).toBe(first.office);
    expect(getAnswerById('missing-id')).toBeUndefined();
  });

  it('indexes every office, including the empty ones', () => {
    const index = officeIndex();
    expect(index).toHaveLength(OFFICES.length);
    expect(OFFICES.length).toBeGreaterThanOrEqual(4);
    expect(OFFICES.length).toBeLessThanOrEqual(6);
    const total = index.reduce((sum, entry) => sum + entry.answers.length, 0);
    expect(total).toBe(ANSWERS.length);
  });

  it('points every answer at an office that exists', () => {
    const ids = new Set(OFFICES.map((office) => office.id));
    for (const answer of ANSWERS) expect(ids.has(answer.office)).toBe(true);
  });

  it('gives every office a unique id', () => {
    expect(new Set(OFFICES.map((o) => o.id)).size).toBe(OFFICES.length);
  });
});

describe('source handling', () => {
  it('treats the TODO sentinel as "no source"', () => {
    expect(hasRealSource({ ...VALID, sourceUrl: 'TODO' })).toBe(false);
    expect(hasRealSource({ ...VALID, sourceUrl: 'not-a-url' })).toBe(false);
    expect(hasRealSource(VALID)).toBe(true);
  });
});
