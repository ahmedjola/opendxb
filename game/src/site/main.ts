/**
 * Landing in Dubai — the site.
 *
 * Renders the arrival hero, the fork (visiting / moving / already living here)
 * and the journey for whichever one you picked. Every answer it puts on screen
 * is read out of `answers.json` verbatim and carries its source link and the
 * date it was checked. Nothing here writes prose about fees, timelines or
 * required documents — that is the content file's job, and only where a source
 * backs it.
 */
import { ANSWERS, hasRealSource } from '../content/loader';
import type { Answer } from '../content/types';
import { initCityOverlay } from './cityOverlay';
import { dirFor, getLang, readLang, setLang, t, writeLang, type Lang } from './i18n';
import { heroSvg } from './hero';
import {
  answersForStep,
  blockedRange,
  getPath,
  isStatusId,
  normalizeCompleted,
  progressPercent,
  resetPath,
  stepStates,
  toggleStep,
  type JourneyPath,
  type JourneyStep,
  type StatusId,
  type StepState,
} from './journey';
import {
  browserStorage,
  clearProgress,
  defaultProgress,
  readProgress,
  writeProgress,
  type Progress,
  type StorageLike,
} from './progress';
import '../styles/site.css';

/* ── tiny DOM helper ───────────────────────────────────────────────────── */

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | undefined> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/* ── state ─────────────────────────────────────────────────────────────── */

const storage: StorageLike | null = browserStorage();
let progress: Progress = readProgress(storage);
/** Which step panels are open. Deliberately not persisted — it is not progress. */
const expanded = new Set<string>();

function completedFor(path: JourneyPath): string[] {
  const stored = progress.completed[path.status];
  if (!stored) return resetPath(path);
  return normalizeCompleted(path, stored);
}

function setCompleted(path: JourneyPath, completed: string[]): void {
  progress = {
    status: progress.status,
    completed: { ...progress.completed, [path.status]: completed },
  };
  persist();
}

function persist(): void {
  const saved = writeProgress(storage, progress);
  storageNote?.toggleAttribute('hidden', saved);
}

/* ── elements ──────────────────────────────────────────────────────────── */

const heroScene = document.getElementById('hero-scene');
const forkGroup = document.getElementById('fork');
const journeySection = document.getElementById('journey');
const journeyBody = document.getElementById('journey-body');
const moreSection = document.getElementById('more');
const moreList = document.getElementById('more-list');
const storageNote = document.getElementById('storage-note');
const resetButton = document.getElementById('reset-progress');

const live = el('p', {
  id: 'live-region',
  class: 'visually-hidden',
  role: 'status',
  'aria-live': 'polite',
});
document.body.append(live);

function announce(message: string): void {
  live.textContent = message;
}

/**
 * A checked date, written the way a person writes one.
 *
 * The raw ISO value reads like a debug field, and worse: inside an Arabic
 * sentence the bidi algorithm reorders `2026-08-23` into `23-08-2026`, which is
 * a different and wrong date. A formatted month name has nothing for it to
 * reorder.
 */
function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(getLang() === 'ar' ? 'ar-AE' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
      numberingSystem: 'latn',
    }).format(date);
  } catch {
    return iso;
  }
}

/* ── content in the reader's language ───────────────────────────────────── */

/**
 * Content carries both languages per entry, so picking one is a lookup.
 *
 * Kept as three tiny helpers rather than inlined ternaries because every one of
 * them is a place where the wrong language could silently leak through.
 */
function stepTitle(step: JourneyStep): string {
  return getLang() === 'ar' ? step.titleAr : step.titleEn;
}

function pathLabel(path: JourneyPath): string {
  return getLang() === 'ar' ? path.labelAr : path.labelEn;
}

function pathIntro(path: JourneyPath): string {
  return getLang() === 'ar' ? path.introAr : path.introEn;
}

/* ── answers ───────────────────────────────────────────────────────────── */

/**
 * One answer, verbatim, with its provenance. There is no code path that renders
 * an answer without its source link and checked date — that is the whole deal
 * this project makes with the reader.
 */
function renderAnswer(answer: Answer): HTMLElement {
  const lang = getLang();
  const article = el('article', { class: 'answer', id: `a-${answer.id}` });

  // One language, not both stacked. Printing every answer twice doubled the
  // page and halved the reading speed in each language.
  article.append(el('h4', {}, lang === 'ar' ? answer.questionAr : answer.questionEn));
  article.append(el('p', { class: 'a-body' }, lang === 'ar' ? answer.answerAr : answer.answerEn));

  const source = el('p', { class: 'source' });
  if (hasRealSource(answer)) {
    // The publisher's name and the link stay exactly as published, in both
    // directions: they are a citation, not copy to be translated.
    source.append(
      el('span', {}, t('answer.source')),
      el(
        'a',
        {
          href: answer.sourceUrl,
          rel: 'noopener noreferrer',
          target: '_blank',
          dir: 'ltr',
        },
        `${answer.sourceEntity} ↗`,
      ),
    );
  } else {
    source.append(el('span', { class: 'source-missing' }, t('answer.noSource')));
  }
  source.append(el('span', { class: 'mono checked' }, t('answer.checked', { date: formatDate(answer.checkedOn) })));
  article.append(source);
  return article;
}

/**
 * The step marks, drawn rather than typed.
 *
 * `✓` and `🔒` were emoji: full-colour, vendor-specific, and completely out of
 * place in a hand-built pixel design. These are square-edged, take their colour
 * from the surrounding text, and look the same on every machine.
 */
const TICK_SVG =
  '<svg viewBox="0 0 12 12" width="14" height="14" fill="currentColor" aria-hidden="true">' +
  '<path d="M1 6h2v2H1zM3 8h2v2H3zM5 6h2v2H5zM7 4h2v2H7zM9 2h2v2H9z"/></svg>';

const LOCK_SVG =
  '<svg viewBox="0 0 12 12" width="14" height="14" fill="currentColor" aria-hidden="true">' +
  '<path d="M4 2h4v2H4zM3 4h1v2H3zM8 4h1v2H8zM2 6h8v5H2z"/></svg>';

/* ── journey ───────────────────────────────────────────────────────────── */

const BADGE_KEY: Partial<Record<StepState, { key: string; kind: string }>> = {
  current: { key: 'journey.badge.current', kind: 'current' },
  complete: { key: 'journey.badge.complete', kind: 'complete' },
  locked: { key: 'journey.badge.locked', kind: 'locked' },
};

function stepNote(
  path: JourneyPath,
  completed: readonly string[],
  state: StepState,
  index: number,
): string | null {
  if (state === 'current') {
    const blocked = blockedRange(path, completed);
    if (!blocked) return t('journey.note.next');
    return blocked.from === blocked.to
      ? t('journey.note.blocksOne', { from: blocked.from })
      : t('journey.note.blocksRange', { from: blocked.from, to: blocked.to });
  }
  if (state === 'locked') {
    // Deliberately silent. The blocking step already says what it blocks, and
    // repeating the same sentence under all seven locked rows read as a loop
    // nobody had looked at.
    return null;
  }
  if (state === 'complete' && index === 0 && path.seedComplete.includes(path.steps[0]?.id ?? '')) {
    return t('journey.note.plane');
  }
  return null;
}

function renderStep(
  path: JourneyPath,
  completed: readonly string[],
  step: JourneyStep,
  state: StepState,
  index: number,
): HTMLElement {
  const number = index + 1;
  const panelId = `panel-${path.status}-${step.id}`;
  const isOpen = expanded.has(step.id);

  const item = el('li', { class: 'step', 'data-state': state, 'data-step': step.id });

  const marker = el('span', { class: 'step-marker', 'data-state': state, 'aria-hidden': 'true' });
  if (state === 'complete') marker.innerHTML = TICK_SVG;
  else if (state === 'locked') marker.innerHTML = LOCK_SVG;
  else marker.textContent = String(number);
  item.append(marker);

  const head = el('div', { class: 'step-head' });
  head.append(
    el(
      'h3',
      { class: 'step-title' },
      el(
        'span',
        { class: 'visually-hidden' },
        t('journey.stepOf', { n: number, total: path.steps.length }),
      ),
      stepTitle(step),
    ),
  );
  const badge = BADGE_KEY[state];
  if (badge) {
    head.append(el('span', { class: 'mono step-badge', 'data-kind': badge.kind }, t(badge.key)));
  }
  item.append(head);

  const note = stepNote(path, completed, state, index);
  if (note) item.append(el('p', { class: 'step-note' }, note));

  const actions = el('div', { class: 'step-actions' });

  const toggle = el(
    'button',
    {
      type: 'button',
      class: 'btn',
      'data-action': 'expand',
      'data-step': step.id,
      'data-focus': `expand-${step.id}`,
      'data-variant': state === 'locked' ? 'quiet' : undefined,
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-controls': panelId,
    },
    isOpen
      ? t('journey.collapse')
      : state === 'locked'
        ? t('journey.expandLocked')
        : t('journey.expand'),
  );
  actions.append(toggle);

  if (state !== 'locked') {
    const done = state === 'complete';
    actions.append(
      el(
        'button',
        {
          type: 'button',
          class: 'btn',
          'data-variant': done ? 'quiet' : 'primary',
          'data-action': 'toggle-complete',
          'data-step': step.id,
          'data-focus': `complete-${step.id}`,
        },
        done ? t('journey.markIncomplete') : t('journey.markComplete'),
      ),
    );
  }
  item.append(actions);

  const panel = el('div', { class: 'step-panel', id: panelId });
  if (!isOpen) panel.setAttribute('hidden', '');
  const stepAnswers = answersForStep(step);
  if (stepAnswers.length === 0) {
    panel.append(
      el('p', { class: 'empty-note' }, t('journey.empty')),
    );
  } else {
    for (const answer of stepAnswers) panel.append(renderAnswer(answer));
  }
  item.append(panel);

  return item;
}

function renderJourney(): void {
  if (!journeySection || !journeyBody) return;

  const status = progress.status;
  if (!status) {
    journeySection.setAttribute('hidden', '');
    moreSection?.setAttribute('hidden', '');
    return;
  }

  const path = getPath(status);
  const completed = completedFor(path);
  const states = stepStates(path, completed);
  const percent = progressPercent(path, completed);

  journeyBody.replaceChildren();

  const head = el('div', { class: 'journey-head' });
  const headMain = el('div', {});
  headMain.append(
    el('p', { class: 'mono section-label' }, `${t('journey.path')} · ${pathLabel(path)}`),
  );
  headMain.append(
    el(
      'h2',
      { id: 'journey-heading' },
      t(path.sequential ? 'journey.heading.sequential' : 'journey.heading.list'),
    ),
  );
  headMain.append(el('p', { class: 'section-intro' }, pathIntro(path)));

  const meter = el('span', {
    class: 'progress-meter',
    role: 'progressbar',
    'aria-valuenow': String(percent),
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-label': `${path.labelEn} progress`,
  });
  meter.append(el('span', { class: 'progress-fill', style: `width:${percent}%` }));
  headMain.append(meter);
  headMain.append(
    el(
      'p',
      { class: 'mono', style: 'color: var(--muted)' },
      t('journey.done', {
        done: normalizeCompleted(path, completed).length,
        total: path.steps.length,
      }),
    ),
  );
  head.append(headMain);

  const headActions = el('div', { class: 'step-actions' });
  headActions.append(
    el(
      'button',
      { type: 'button', class: 'btn', 'data-action': 'change-status', 'data-focus': 'change' },
      t('journey.changeStatus'),
    ),
  );
  headActions.append(
    el(
      'button',
      {
        type: 'button',
        class: 'btn',
        'data-variant': 'quiet',
        'data-action': 'reset-path',
        'data-focus': 'reset',
      },
      t('journey.resetPath'),
    ),
  );
  head.append(headActions);
  journeyBody.append(head);

  const list = el('ol', { class: 'steps' });
  path.steps.forEach((step, index) => {
    const state = states[index] ?? 'open';
    list.append(renderStep(path, completed, step, state, index));
  });
  journeyBody.append(list);

  journeySection.removeAttribute('hidden');
  renderMore(path);
}

/** Answers that exist but are not on the path you picked. Never hidden away. */
function renderMore(path: JourneyPath): void {
  if (!moreSection || !moreList) return;
  const onPath = new Set(path.steps.flatMap((step) => [...step.answerIds]));
  const rest = ANSWERS.filter((answer) => !onPath.has(answer.id));
  moreList.replaceChildren();
  if (rest.length === 0) {
    moreSection.setAttribute('hidden', '');
    return;
  }
  for (const answer of rest) moreList.append(renderAnswer(answer));
  moreSection.removeAttribute('hidden');
}

/* ── fork ──────────────────────────────────────────────────────────────── */

function renderFork(): void {
  if (!forkGroup) return;
  for (const card of forkGroup.querySelectorAll<HTMLButtonElement>('.fork-card')) {
    const status = card.dataset['status'];
    card.setAttribute('aria-pressed', status === progress.status ? 'true' : 'false');
  }
}

function selectStatus(status: StatusId, focusJourney: boolean): void {
  const path = getPath(status);
  const alreadyStored = progress.completed[status];
  progress = {
    status,
    completed: {
      ...progress.completed,
      [status]: alreadyStored ? normalizeCompleted(path, alreadyStored) : resetPath(path),
    },
  };
  persist();

  // Open the step you are actually on, and nothing else.
  expanded.clear();
  const completed = completedFor(path);
  const currentIndex = stepStates(path, completed).indexOf('current');
  const current = currentIndex >= 0 ? path.steps[currentIndex] : undefined;
  if (current) expanded.add(current.id);

  renderFork();
  renderJourney();
  announce(`${pathLabel(path)} · ${path.steps.length}`);

  if (focusJourney) {
    const heading = document.getElementById('journey-heading');
    heading?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
}

function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/* ── events ────────────────────────────────────────────────────────────── */

/** Re-render, then put focus back on the control the user just used. */
function rerenderKeepingFocus(focusKey: string | undefined): void {
  renderJourney();
  if (!focusKey) return;
  const next = document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`);
  next?.focus();
}

forkGroup?.addEventListener('click', (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>('.fork-card');
  const status = card?.dataset['status'];
  if (isStatusId(status)) selectStatus(status, true);
});

journeyBody?.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (!button) return;
  const action = button.dataset['action'];
  const status = progress.status;
  if (!status) return;
  const path = getPath(status);

  if (action === 'expand') {
    const stepId = button.dataset['step'];
    if (!stepId) return;
    if (expanded.has(stepId)) expanded.delete(stepId);
    else expanded.add(stepId);
    rerenderKeepingFocus(button.dataset['focus']);
    return;
  }

  if (action === 'toggle-complete') {
    const stepId = button.dataset['step'];
    if (!stepId) return;
    const before = completedFor(path);
    const after = toggleStep(path, before, stepId);
    setCompleted(path, after);

    const index = path.steps.findIndex((step) => step.id === stepId);
    const nowComplete = after.includes(stepId);
    if (nowComplete) {
      const nextIndex = stepStates(path, after).indexOf('current');
      const next = nextIndex >= 0 ? path.steps[nextIndex] : undefined;
      expanded.delete(stepId);
      if (next) expanded.add(next.id);
      announce(
        next
          ? `Step ${index + 1} marked complete. Step ${nextIndex + 1}, ${next.titleEn}, is now unlocked.`
          : `Step ${index + 1} marked complete. That is the whole path.`,
      );
    } else {
      announce(`Step ${index + 1} marked not done.`);
    }
    rerenderKeepingFocus(button.dataset['focus']);
    return;
  }

  if (action === 'reset-path') {
    setCompleted(path, resetPath(path));
    expanded.clear();
    announce(`${path.labelEn} path reset.`);
    rerenderKeepingFocus('reset');
    return;
  }

  if (action === 'change-status') {
    document
      .getElementById('start')
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    forkGroup?.querySelector<HTMLButtonElement>('.fork-card[data-primary="true"]')?.focus();
  }
});

resetButton?.addEventListener('click', () => {
  clearProgress(storage);
  progress = defaultProgress();
  expanded.clear();
  renderFork();
  renderJourney();
  announce('Progress cleared.');
  document
    .getElementById('start')
    ?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
});

/* ── language ──────────────────────────────────────────────────────────── */

/**
 * Apply a language to the whole document.
 *
 * `lang` and `dir` on <html> are what actually do the work: the browser mirrors
 * the layout, picks the right shaping for Arabic, and tells assistive tech
 * which language it is reading. Everything else here is copy replacement.
 */
function applyLang(lang: Lang, save: boolean): void {
  setLang(lang);
  const root = document.documentElement;
  root.setAttribute('lang', lang);
  root.setAttribute('dir', dirFor(lang));
  document.title = t('doc.title');

  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset['i18n'];
    if (key) node.textContent = t(key);
    const labelKey = node.dataset['i18nLabel'];
    if (labelKey) node.setAttribute('aria-label', t(labelKey));
  }

  langToggle?.setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
  if (save) writeLang(storage as Pick<Storage, 'setItem'> | null, lang);

  renderFork();
  renderJourney();
}

const langToggle = document.getElementById('lang-toggle');
langToggle?.addEventListener('click', () => {
  const next: Lang = getLang() === 'ar' ? 'en' : 'ar';
  applyLang(next, true);
  // Keep focus on the control that was just used, so a keyboard user is not
  // thrown back to the top of a page that has just changed direction.
  langToggle.focus();
});

/* ── boot ──────────────────────────────────────────────────────────────── */

if (heroScene) heroScene.innerHTML = heroSvg();
// Mounts hidden and loads nothing until someone asks for it.
initCityOverlay();
if (!storage) storageNote?.removeAttribute('hidden');
applyLang(readLang(storage as Pick<Storage, 'getItem'> | null), false);
if (progress.status) selectStatus(progress.status, false);
