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

/* ── answers ───────────────────────────────────────────────────────────── */

/**
 * One answer, verbatim, with its provenance. There is no code path that renders
 * an answer without its source link and checked date — that is the whole deal
 * this project makes with the reader.
 */
function renderAnswer(answer: Answer): HTMLElement {
  const article = el('article', { class: 'answer', id: `a-${answer.id}` });
  article.append(el('h4', {}, answer.questionEn));
  article.append(el('p', { class: 'q-ar', lang: 'ar', dir: 'rtl' }, answer.questionAr));
  article.append(el('p', { class: 'a-en' }, answer.answerEn));
  article.append(el('p', { class: 'a-ar', lang: 'ar', dir: 'rtl' }, answer.answerAr));

  const source = el('p', { class: 'source' });
  if (hasRealSource(answer)) {
    source.append(
      el('span', {}, 'Source: '),
      el(
        'a',
        { href: answer.sourceUrl, rel: 'noopener noreferrer', target: '_blank' },
        `${answer.sourceEntity} ↗`,
      ),
    );
  } else {
    source.append(
      el('span', { class: 'source-missing' }, 'No source link attached yet — do not rely on this'),
    );
  }
  source.append(el('span', { class: 'mono checked' }, `Checked ${answer.checkedOn}`));
  article.append(source);
  return article;
}

/* ── journey ───────────────────────────────────────────────────────────── */

const BADGE: Partial<Record<StepState, { text: string; kind: string }>> = {
  current: { text: 'You are here', kind: 'current' },
  complete: { text: 'Done', kind: 'complete' },
  locked: { text: 'Locked', kind: 'locked' },
};

function stepNote(
  path: JourneyPath,
  completed: readonly string[],
  state: StepState,
  index: number,
): string | null {
  if (state === 'current') {
    const blocked = blockedRange(path, completed);
    if (!blocked) return 'This is the next thing to deal with.';
    return blocked.from === blocked.to
      ? `Blocks step ${blocked.from}.`
      : `Blocks steps ${blocked.from}–${blocked.to}.`;
  }
  if (state === 'locked') {
    const current = stepStates(path, completed).indexOf('current');
    const needed = path.steps[current];
    if (!needed) return 'Locked.';
    return `Locked — you cannot start this until step ${current + 1}, ${needed.titleEn}, is done.`;
  }
  if (state === 'complete' && index === 0 && path.seedComplete.includes(path.steps[0]?.id ?? '')) {
    return 'You did this one by getting on the plane.';
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

  item.append(
    el(
      'span',
      { class: 'step-marker', 'aria-hidden': 'true' },
      state === 'complete' ? '✓' : state === 'locked' ? '🔒' : String(number),
    ),
  );

  const head = el('div', { class: 'step-head' });
  head.append(
    el(
      'h3',
      { class: 'step-title' },
      el('span', { class: 'visually-hidden' }, `Step ${number} of ${path.steps.length}: `),
      step.titleEn,
    ),
  );
  head.append(el('span', { class: 'step-ar', lang: 'ar', dir: 'rtl' }, step.titleAr));
  const badge = BADGE[state];
  if (badge) {
    head.append(el('span', { class: 'mono step-badge', 'data-kind': badge.kind }, badge.text));
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
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-controls': panelId,
    },
    isOpen ? 'Hide' : state === 'locked' ? 'Read ahead anyway' : 'What this involves',
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
        done ? 'Mark not done' : 'Mark complete',
      ),
    );
  }
  item.append(actions);

  const panel = el('div', { class: 'step-panel', id: panelId });
  if (!isOpen) panel.setAttribute('hidden', '');
  const stepAnswers = answersForStep(step);
  if (stepAnswers.length === 0) {
    panel.append(
      el(
        'p',
        { class: 'empty-note' },
        'No sourced answer has been written for this step yet. Rather than guess, this page says nothing.',
      ),
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
  headMain.append(el('p', { class: 'mono section-label' }, `Your path · ${path.labelEn}`));
  headMain.append(
    el(
      'h2',
      { id: 'journey-heading' },
      path.sequential ? 'The ' : 'Your ',
      el('b', {}, path.sequential ? 'nine steps' : 'short list'),
      path.sequential ? ', in order' : '',
    ),
  );
  headMain.append(el('p', { class: 'section-intro' }, path.introEn));

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
      `${normalizeCompleted(path, completed).length} of ${path.steps.length} done`,
    ),
  );
  head.append(headMain);

  const headActions = el('div', { class: 'step-actions' });
  headActions.append(
    el(
      'button',
      { type: 'button', class: 'btn', 'data-action': 'change-status', 'data-focus': 'change' },
      'Change who I am',
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
      'Start this path over',
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
  announce(`Showing the ${path.labelEn} path: ${path.steps.length} steps.`);

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

/* ── boot ──────────────────────────────────────────────────────────────── */

if (heroScene) heroScene.innerHTML = heroSvg();
// Mounts hidden and loads nothing until someone asks for it.
initCityOverlay();
if (!storage) storageNote?.removeAttribute('hidden');
renderFork();
if (progress.status) selectStatus(progress.status, false);
