/**
 * The journey — what a person actually has to get through, in order.
 *
 * This file holds STRUCTURE ONLY: the name of each step, and which answers in
 * `answers.json` speak to it. It states no fee, no timeline and no document
 * list of its own. Everything a reader is told comes out of the content file
 * verbatim, with its source link and the date it was checked.
 *
 * The one claim this file does make is ORDERING — that some steps cannot start
 * until an earlier one is done. That claim is not invented either: it is only
 * asserted on the "moving here" path, and every locked step there is backed by
 * a sourced answer that describes the dependency (for example, DEWA's own page
 * on needing Ejari first).
 */
import { getAnswerById } from '../content/loader';
import type { Answer } from '../content/types';

export type StatusId = 'visiting' | 'moving' | 'resident';

export const STATUS_IDS: readonly StatusId[] = ['visiting', 'moving', 'resident'];

export function isStatusId(value: unknown): value is StatusId {
  return typeof value === 'string' && (STATUS_IDS as readonly string[]).includes(value);
}

/** How a step reads right now. `locked` only ever happens on a sequential path. */
export type StepState = 'complete' | 'current' | 'open' | 'locked';

export interface JourneyStep {
  /** Unique within its path. */
  id: string;
  titleEn: string;
  titleAr: string;
  /** Ids in answers.json. Rendered verbatim, with source + checked date. */
  answerIds: readonly string[];
}

export interface JourneyPath {
  status: StatusId;
  labelEn: string;
  labelAr: string;
  /** One line of framing. Says nothing a source would need to back. */
  introEn: string;
  introAr: string;
  /**
   * Sequential paths lock later steps behind earlier ones. Only "moving here"
   * is sequential — a visitor's questions and a resident's questions are not
   * prerequisites for each other, and pretending otherwise would be a lie
   * dressed up as a product idea.
   */
  sequential: boolean;
  /** Steps already done by the time you are reading this (you have landed). */
  seedComplete: readonly string[];
  steps: readonly JourneyStep[];
}

const MOVING: JourneyPath = {
  status: 'moving',
  labelEn: 'Moving here',
  labelAr: 'أنتقل للعيش هنا',
  introEn:
    'Nine steps, in the order the departments actually need them. Later steps stay locked until the step they depend on is done.',
  introAr:
    'تسع خطوات بالترتيب الذي تحتاجه الدوائر فعليًا. تبقى الخطوات اللاحقة مقفلة حتى تُنجَز الخطوة التي تعتمد عليها.',
  sequential: true,
  seedComplete: ['arrival'],
  steps: [
    {
      id: 'arrival',
      titleEn: 'Entry permit & arrival',
      titleAr: 'تصريح الدخول والوصول',
      answerIds: ['residence-visa-basic-process'],
    },
    {
      id: 'medical',
      titleEn: 'Medical fitness test',
      titleAr: 'الفحص الطبي للياقة',
      answerIds: ['residence-visa-medical-test'],
    },
    {
      id: 'residence-visa',
      titleEn: 'Residence visa',
      titleAr: 'تأشيرة الإقامة',
      answerIds: ['residence-visa-types', 'emirates-id-replaces-visa-sticker'],
    },
    {
      id: 'emirates-id',
      titleEn: 'Emirates ID',
      titleAr: 'الهوية الإماراتية',
      answerIds: ['emirates-id-what-is-it', 'emirates-id-how-to-apply'],
    },
    {
      id: 'home-ejari',
      titleEn: 'Home + Ejari',
      titleAr: 'السكن وعقد إيجاري',
      answerIds: ['ejari-what-and-why', 'ejari-how-to-register'],
    },
    {
      id: 'dewa',
      titleEn: 'DEWA (water & electricity)',
      titleAr: 'هيئة كهرباء ومياه دبي',
      answerIds: ['dewa-needs-ejari-first', 'dewa-move-in'],
    },
    {
      id: 'health-insurance',
      titleEn: 'Health insurance',
      titleAr: 'التأمين الصحي',
      answerIds: ['dubai-health-insurance-mandate', 'health-insurance-dependents'],
    },
    {
      id: 'bank-account',
      titleEn: 'Bank account',
      titleAr: 'الحساب البنكي',
      answerIds: ['bank-account-documents', 'bank-account-how-to-open'],
    },
    {
      id: 'driving-licence',
      titleEn: 'Driving licence',
      titleAr: 'رخصة القيادة',
      answerIds: ['driving-licence-exchange', 'driving-licence-start-fresh'],
    },
  ],
};

const VISITING: JourneyPath = {
  status: 'visiting',
  labelEn: 'Just visiting',
  labelAr: 'زائر',
  introEn:
    'A short list. Nothing here is locked — a visitor’s questions are not prerequisites for each other.',
  introAr:
    'قائمة قصيرة. لا شيء هنا مقفل — فأسئلة الزائر ليست شرطًا لبعضها البعض.',
  sequential: false,
  seedComplete: ['v-entry'],
  steps: [
    {
      id: 'v-entry',
      titleEn: 'Getting in',
      titleAr: 'الدخول إلى الدولة',
      answerIds: ['residence-visa-basic-process'],
    },
    {
      id: 'v-driving',
      titleEn: 'Driving while you are here',
      titleAr: 'القيادة أثناء وجودك',
      answerIds: ['driving-licence-exchange', 'driving-licence-start-fresh'],
    },
    {
      id: 'v-health',
      titleEn: 'Health cover',
      titleAr: 'التغطية الصحية',
      answerIds: ['dubai-health-insurance-mandate'],
    },
    {
      id: 'v-staying',
      titleEn: 'If you decide to stay',
      titleAr: 'إذا قررت البقاء',
      answerIds: ['residence-visa-types', 'emirates-id-what-is-it'],
    },
  ],
};

const RESIDENT: JourneyPath = {
  status: 'resident',
  labelEn: 'Already living here',
  labelAr: 'مقيم',
  introEn:
    'The things that come back around once you are settled. Open in any order — tick off what you have dealt with.',
  introAr:
    'الأمور التي تتكرر بعد أن تستقر. افتحها بأي ترتيب، وضع علامة على ما أنجزته.',
  sequential: false,
  seedComplete: [],
  steps: [
    {
      id: 'r-id',
      titleEn: 'Emirates ID & proof of residency',
      titleAr: 'الهوية الإماراتية وإثبات الإقامة',
      answerIds: [
        'emirates-id-what-is-it',
        'emirates-id-replaces-visa-sticker',
        'emirates-id-how-to-apply',
      ],
    },
    {
      id: 'r-ejari',
      titleEn: 'Tenancy & Ejari',
      titleAr: 'عقد الإيجار وإيجاري',
      answerIds: ['ejari-what-and-why', 'ejari-how-to-register'],
    },
    {
      id: 'r-dewa',
      titleEn: 'DEWA account',
      titleAr: 'حساب هيئة كهرباء ومياه دبي',
      answerIds: ['dewa-move-in', 'dewa-needs-ejari-first'],
    },
    {
      id: 'r-insurance',
      titleEn: 'Insuring your family',
      titleAr: 'تأمين أفراد الأسرة',
      answerIds: ['health-insurance-dependents', 'dubai-health-insurance-mandate'],
    },
    {
      id: 'r-schools',
      titleEn: 'Schools & KHDA',
      titleAr: 'المدارس وهيئة المعرفة',
      answerIds: ['khda-role', 'school-enrolment-what-parents-need'],
    },
    {
      id: 'r-bank',
      titleEn: 'Bank account',
      titleAr: 'الحساب البنكي',
      answerIds: ['bank-account-documents', 'bank-account-how-to-open'],
    },
    {
      id: 'r-driving',
      titleEn: 'Driving licence',
      titleAr: 'رخصة القيادة',
      answerIds: ['driving-licence-exchange', 'driving-licence-start-fresh'],
    },
  ],
};

export const PATHS: Readonly<Record<StatusId, JourneyPath>> = {
  visiting: VISITING,
  moving: MOVING,
  resident: RESIDENT,
};

export function getPath(status: StatusId): JourneyPath {
  return PATHS[status];
}

/** Every answer id referenced by any path, in first-seen order. */
export function referencedAnswerIds(): string[] {
  const seen: string[] = [];
  for (const status of STATUS_IDS) {
    for (const step of PATHS[status].steps) {
      for (const id of step.answerIds) if (!seen.includes(id)) seen.push(id);
    }
  }
  return seen;
}

/** The answers a step points at, in order. Unknown ids are dropped, not faked. */
export function answersForStep(step: JourneyStep): Answer[] {
  const out: Answer[] = [];
  for (const id of step.answerIds) {
    const answer = getAnswerById(id);
    if (answer) out.push(answer);
  }
  return out;
}

/**
 * Clean up a completed list so it can never describe an impossible state:
 * unknown ids are dropped, order follows the path, and on a sequential path
 * only the unbroken run from the start survives (you cannot have finished
 * step 5 without step 4).
 */
export function normalizeCompleted(
  path: JourneyPath,
  completed: readonly string[],
): string[] {
  const done = new Set(completed);
  const out: string[] = [];
  for (const step of path.steps) {
    if (!done.has(step.id)) {
      if (path.sequential) break;
      continue;
    }
    out.push(step.id);
  }
  return out;
}

/**
 * The state of every step, in path order.
 *
 * - complete: ticked off.
 * - current : the first step that is not complete — "YOU ARE HERE".
 * - locked  : after the current step, on a sequential path only.
 * - open    : after the current step, on a non-sequential path.
 */
export function stepStates(path: JourneyPath, completed: readonly string[]): StepState[] {
  const done = new Set(normalizeCompleted(path, completed));
  let currentSeen = false;
  return path.steps.map((step) => {
    if (done.has(step.id)) return 'complete';
    if (!currentSeen) {
      currentSeen = true;
      return 'current';
    }
    return path.sequential ? 'locked' : 'open';
  });
}

/** Index of the "YOU ARE HERE" step, or -1 when the whole path is done. */
export function currentStepIndex(path: JourneyPath, completed: readonly string[]): number {
  return stepStates(path, completed).indexOf('current');
}

export function isUnlocked(
  path: JourneyPath,
  completed: readonly string[],
  stepId: string,
): boolean {
  const index = path.steps.findIndex((step) => step.id === stepId);
  if (index === -1) return false;
  const state = stepStates(path, completed)[index];
  return state !== 'locked';
}

/**
 * The run of steps the current step is holding up, as 1-based numbers.
 * Null when nothing is blocked (non-sequential paths, or the last step).
 */
export function blockedRange(
  path: JourneyPath,
  completed: readonly string[],
): { from: number; to: number } | null {
  if (!path.sequential) return null;
  const states = stepStates(path, completed);
  const current = states.indexOf('current');
  if (current === -1) return null;
  const firstLocked = states.indexOf('locked');
  if (firstLocked === -1) return null;
  return { from: firstLocked + 1, to: path.steps.length };
}

/**
 * Tick a step off. A locked step cannot be completed — that is the whole point
 * of the lock — and completing the current step is what unlocks the next one.
 */
export function markComplete(
  path: JourneyPath,
  completed: readonly string[],
  stepId: string,
): string[] {
  if (!isUnlocked(path, completed, stepId)) return normalizeCompleted(path, completed);
  return normalizeCompleted(path, [...completed, stepId]);
}

/** Un-tick a step. On a sequential path this also un-ticks everything after it. */
export function markIncomplete(
  path: JourneyPath,
  completed: readonly string[],
  stepId: string,
): string[] {
  const next = normalizeCompleted(path, completed).filter((id) => id !== stepId);
  return normalizeCompleted(path, next);
}

export function toggleStep(
  path: JourneyPath,
  completed: readonly string[],
  stepId: string,
): string[] {
  const done = new Set(normalizeCompleted(path, completed));
  return done.has(stepId)
    ? markIncomplete(path, completed, stepId)
    : markComplete(path, completed, stepId);
}

export function resetPath(path: JourneyPath): string[] {
  return normalizeCompleted(path, path.seedComplete);
}

export function progressPercent(path: JourneyPath, completed: readonly string[]): number {
  if (path.steps.length === 0) return 0;
  return Math.round((normalizeCompleted(path, completed).length / path.steps.length) * 100);
}
