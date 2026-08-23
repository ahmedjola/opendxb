/**
 * Plain HTML guide — the accessibility guarantee.
 *
 * Renders the *same* content the game shows, as semantic, keyboard-navigable
 * HTML: headings, in-page links, and a real <a> for every source. No canvas, no
 * pointer-only interaction, no runtime-generated answers.
 */
import { NO_SOURCE_SENTINEL, hasRealSource, officeIndex } from './content/loader';
import type { Answer, Office } from './content/types';
import { browserStorage } from './site/progress';
import { dirFor, getLang, readLang, setLang, t, writeLang, type Lang } from './site/i18n';
import './styles/guide.css';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function renderSource(answer: Answer): HTMLElement {
  const p = el('p', { class: 'source' });
  p.append(t('answer.source'));
  if (hasRealSource(answer)) {
    p.append(
      el('a', { href: answer.sourceUrl, rel: 'noopener noreferrer' }, answer.sourceEntity),
    );
    p.append(` (${answer.sourceUrl})`);
  } else {
    p.append(
      el(
        'span',
        { class: 'source-missing' },
        `${NO_SOURCE_SENTINEL} — no source link attached yet`,
      ),
    );
  }
  p.append(el('br'), t('answer.checked', { date: answer.checkedOn }));
  return p;
}

function renderAnswer(answer: Answer): HTMLElement {
  const ar = getLang() === 'ar';
  const article = el('article', { class: 'answer', id: `answer-${answer.id}` });
  // One language, matching the rest of the site. Both stacked doubled the
  // length of a page whose entire job is being quick to read.
  article.append(el('h3', {}, ar ? answer.questionAr : answer.questionEn));

  if (!hasRealSource(answer)) {
    article.append(el('p', { class: 'placeholder-flag' }, 'PLACEHOLDER — NOT VERIFIED'));
  }

  article.append(el('p', {}, ar ? answer.answerAr : answer.answerEn));
  article.append(renderSource(answer));
  return article;
}

function renderOffice(office: Office, answers: Answer[]): HTMLElement {
  const section = el('section', {
    class: 'office',
    id: `office-${office.id}`,
    'aria-labelledby': `office-${office.id}-title`,
  });
  section.append(
    el(
      'h2',
      { id: `office-${office.id}-title` },
      getLang() === 'ar' ? office.nameAr : office.nameEn,
    ),
  );
  section.append(el('p', { class: 'office-blurb' }, office.blurbEn));

  if (answers.length === 0) {
    section.append(
      el(
        'p',
        { class: 'empty' },
        'No questions have been written for this office yet. Sourced content is still being added.',
      ),
    );
    return section;
  }
  for (const answer of answers) section.append(renderAnswer(answer));
  return section;
}

export function renderGuide(root: HTMLElement, nav: HTMLElement): void {
  // Replace, do not append: this runs again on every language switch, and
  // appending left the previous language's articles stacked above the new ones
  // — 18 answers became 36, the first half of them in the wrong language.
  root.replaceChildren();
  nav.replaceChildren();

  const index = officeIndex();

  const list = el('ol');
  for (const { office, answers } of index) {
    const count =
      answers.length === 1 ? t('city.oneQuestion') : t('city.questions', { n: answers.length });
    list.append(
      el(
        'li',
        {},
        el(
          'a',
          { href: `#office-${office.id}` },
          getLang() === 'ar' ? office.nameAr : office.nameEn,
        ),
        ` — ${count}`,
      ),
    );
  }
  nav.append(el('h2', {}, t('guide.offices')), list);

  for (const { office, answers } of index) root.append(renderOffice(office, answers));
}

const officesRoot = document.getElementById('offices');
const navRoot = document.getElementById('office-nav');
const storage = browserStorage();

/** Apply a language to the document and redraw. Same contract as the site. */
function applyLang(lang: Lang, save: boolean): void {
  setLang(lang);
  const root = document.documentElement;
  root.setAttribute('lang', lang);
  root.setAttribute('dir', dirFor(lang));
  for (const node of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = node.dataset['i18n'];
    if (key) node.textContent = t(key);
  }
  if (save) writeLang(storage, lang);
  if (officesRoot && navRoot) renderGuide(officesRoot, navRoot);
}

document.getElementById('lang-toggle')?.addEventListener('click', (event) => {
  applyLang(getLang() === 'ar' ? 'en' : 'ar', true);
  (event.currentTarget as HTMLElement).focus();
});

applyLang(readLang(storage), false);
