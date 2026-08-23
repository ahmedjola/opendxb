/**
 * Content types for Landing in Dubai.
 *
 * IMPORTANT: answers are DATA. They are authored in `answers.json`, validated at
 * load time, and rendered verbatim. Nothing here generates, paraphrases or
 * summarises an answer at runtime.
 */

/** A single question/answer pair, always carrying its own provenance. */
export interface Answer {
  /** Stable slug, unique across the whole content file. */
  id: string;
  /** Office id this answer lives in — must match an `Office.id`. */
  office: string;
  questionEn: string;
  questionAr: string;
  answerEn: string;
  answerAr: string;
  /**
   * Link to the authoritative source for this answer.
   * The literal string "TODO" marks an unsourced placeholder: it is required to
   * be present, but it is NOT a valid source and the UI must flag it.
   */
  sourceUrl: string;
  /** Human-readable name of the body/publisher the answer came from. */
  sourceEntity: string;
  /** ISO date (YYYY-MM-DD) the answer was last checked against its source. */
  checkedOn: string;
}

/** A fictional, generic office building in the district. */
export interface Office {
  id: string;
  nameEn: string;
  nameAr: string;
  /** One-line description of what this desk covers. */
  blurbEn: string;
  /** Grid position in the district (tile coords), set in offices.ts. */
  x: number;
  y: number;
  /** Placeholder pixel-art palette for the building. */
  wall: number;
  roof: number;
}

/** Marker used in placeholder content until a real source is attached. */
export const PLACEHOLDER_MARKER = 'PLACEHOLDER — NOT VERIFIED';

/** The literal sentinel that stands in for a missing source link. */
export const NO_SOURCE_SENTINEL = 'TODO';

export const REQUIRED_ANSWER_FIELDS = [
  'id',
  'office',
  'questionEn',
  'questionAr',
  'answerEn',
  'answerAr',
  'sourceUrl',
  'sourceEntity',
  'checkedOn',
] as const satisfies readonly (keyof Answer)[];
