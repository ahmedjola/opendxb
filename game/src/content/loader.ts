import rawAnswers from './answers.json';
import { OFFICES, getOffice } from './offices';
import {
  NO_SOURCE_SENTINEL,
  PLACEHOLDER_MARKER,
  REQUIRED_ANSWER_FIELDS,
  type Answer,
  type Office,
} from './types';

/** Shown persistently in every surface of this project. */
export const DISCLAIMER = 'Unofficial guide — always confirm with the official source.';

export class ContentValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Invalid content: ${issues.join('; ')}`);
    this.name = 'ContentValidationError';
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Collect every problem with a single candidate entry.
 * A field is invalid when it is missing, not a string, or blank/whitespace —
 * `sourceUrl` is treated exactly like the rest, so an entry without one fails.
 */
export function findAnswerIssues(candidate: unknown, where = 'entry'): string[] {
  if (!isRecord(candidate)) return [`${where}: expected an object`];

  const label =
    typeof candidate['id'] === 'string' && candidate['id'].trim() !== ''
      ? `${where} "${candidate['id']}"`
      : where;

  const issues: string[] = [];
  for (const field of REQUIRED_ANSWER_FIELDS) {
    const value = candidate[field];
    if (value === undefined || value === null) {
      issues.push(`${label}: missing required field "${field}"`);
    } else if (typeof value !== 'string') {
      issues.push(`${label}: field "${field}" must be a string`);
    } else if (value.trim() === '') {
      issues.push(`${label}: field "${field}" must not be empty`);
    }
  }

  const checkedOn = candidate['checkedOn'];
  if (typeof checkedOn === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) {
    issues.push(`${label}: "checkedOn" must be an ISO date (YYYY-MM-DD)`);
  }

  return issues;
}

/** Validate one entry, or throw. */
export function validateAnswer(candidate: unknown, where = 'entry'): Answer {
  const issues = findAnswerIssues(candidate, where);
  if (issues.length > 0) throw new ContentValidationError(issues);
  return candidate as Answer;
}

/**
 * Validate a whole content file: every entry well-formed, ids unique, and every
 * `office` pointing at an office that actually exists in the district.
 */
export function loadAnswers(
  data: unknown,
  offices: readonly Office[] = OFFICES,
): Answer[] {
  if (!Array.isArray(data)) throw new ContentValidationError(['content must be an array']);

  const issues: string[] = [];
  const seen = new Set<string>();
  const officeIds = new Set(offices.map((o) => o.id));

  data.forEach((candidate, index) => {
    issues.push(...findAnswerIssues(candidate, `entry #${index}`));
    if (!isRecord(candidate)) return;

    const id = candidate['id'];
    if (typeof id === 'string' && id.trim() !== '') {
      if (seen.has(id)) issues.push(`entry #${index}: duplicate id "${id}"`);
      seen.add(id);
    }

    const office = candidate['office'];
    if (typeof office === 'string' && office.trim() !== '' && !officeIds.has(office)) {
      issues.push(`entry #${index}: unknown office "${office}"`);
    }
  });

  if (issues.length > 0) throw new ContentValidationError(issues);
  return data as Answer[];
}

/** The project's content, validated at import time. Never generated at runtime. */
export const ANSWERS: readonly Answer[] = loadAnswers(rawAnswers);

export function getAnswersForOffice(
  officeId: string,
  answers: readonly Answer[] = ANSWERS,
): Answer[] {
  return answers.filter((a) => a.office === officeId);
}

export function getAnswerById(
  id: string,
  answers: readonly Answer[] = ANSWERS,
): Answer | undefined {
  return answers.find((a) => a.id === id);
}

/** An answer is only "sourced" once it has a real link, not the TODO sentinel. */
export function hasRealSource(answer: Answer): boolean {
  return answer.sourceUrl.trim() !== NO_SOURCE_SENTINEL && /^https?:\/\//i.test(answer.sourceUrl.trim());
}

export function isPlaceholder(answer: Answer): boolean {
  return !hasRealSource(answer) || answer.answerEn.includes(PLACEHOLDER_MARKER);
}

/** Offices paired with their answers, for menus and the plain HTML guide. */
export function officeIndex(
  answers: readonly Answer[] = ANSWERS,
  offices: readonly Office[] = OFFICES,
): { office: Office; answers: Answer[] }[] {
  return offices.map((office) => ({
    office,
    answers: answers.filter((a) => a.office === office.id),
  }));
}

export { OFFICES, getOffice, NO_SOURCE_SENTINEL, PLACEHOLDER_MARKER };
export type { Answer, Office };
