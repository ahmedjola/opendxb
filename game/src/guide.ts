/**
 * Plain HTML guide — the accessibility guarantee.
 *
 * Renders the *same* content the game shows, as semantic, keyboard-navigable
 * HTML: headings, in-page links, and a real <a> for every source. No canvas, no
 * pointer-only interaction, no runtime-generated answers.
 */
import { NO_SOURCE_SENTINEL, hasRealSource, officeIndex } from './content/loader';
import type { Answer, Office } from './content/types';
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
  p.append('Source: ');
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
  p.append(el('br'), `Checked on: ${answer.checkedOn}`);
  return p;
}

function renderAnswer(answer: Answer): HTMLElement {
  const article = el('article', { class: 'answer', id: `answer-${answer.id}` });
  article.append(el('h3', {}, answer.questionEn));
  article.append(el('p', { lang: 'ar', dir: 'rtl' }, answer.questionAr));

  if (!hasRealSource(answer)) {
    article.append(el('p', { class: 'placeholder-flag' }, 'PLACEHOLDER — NOT VERIFIED'));
  }

  article.append(el('p', {}, answer.answerEn));
  article.append(el('p', { lang: 'ar', dir: 'rtl' }, answer.answerAr));
  article.append(renderSource(answer));
  return article;
}

function renderOffice(office: Office, answers: Answer[]): HTMLElement {
  const section = el('section', {
    class: 'office',
    id: `office-${office.id}`,
    'aria-labelledby': `office-${office.id}-title`,
  });
  section.append(el('h2', { id: `office-${office.id}-title` }, office.nameEn));
  section.append(el('p', { lang: 'ar', dir: 'rtl' }, office.nameAr));
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
  const index = officeIndex();

  const list = el('ol');
  for (const { office, answers } of index) {
    const count = answers.length === 1 ? '1 question' : `${answers.length} questions`;
    list.append(
      el(
        'li',
        {},
        el('a', { href: `#office-${office.id}` }, office.nameEn),
        ` — ${count}`,
      ),
    );
  }
  nav.append(el('h2', {}, 'Offices'), list);

  for (const { office, answers } of index) root.append(renderOffice(office, answers));
}

const officesRoot = document.getElementById('offices');
const navRoot = document.getElementById('office-nav');
if (officesRoot && navRoot) renderGuide(officesRoot, navRoot);
