import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * A guard against the bug that has now shipped twice.
 *
 * Both stylesheets had a skip link parked at `left: -9999px`. Under `dir="rtl"`
 * that is 9,999px off the RIGHT edge, which gave the Arabic pages an
 * 11,000-pixel-wide document and a horizontal scrollbar on every screen. The
 * same half-finished physical-to-logical conversion also put a step badge on
 * top of Arabic titles and darkened the wrong side of the hero.
 *
 * Physical properties are not banned outright — `top`, `bottom`, `width` and a
 * symmetric `padding` shorthand are all direction-neutral. What is banned is
 * the set that silently means the opposite thing when the document flips.
 */
const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../src/styles/${name}`, import.meta.url)), 'utf8');

/** Strip comments, so prose about `margin-left` never fails the build. */
function code(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

const BANNED = [
  'margin-left',
  'margin-right',
  'padding-left',
  'padding-right',
  'border-left',
  'border-right',
];

describe.each(['site.css', 'guide.css', 'game.css'])('%s is direction-safe', (file) => {
  const css = code(read(file));

  it('uses logical box properties, not physical ones', () => {
    const found = BANNED.filter((property) => new RegExp(`(^|[;{\\s])${property}\\s*:`).test(css));
    expect(found, `use the -inline-start/-inline-end form instead`).toEqual([]);
  });

  it('does not align text to a physical side', () => {
    // `text-align: left` on a right-to-left page is a bug, always.
    expect(css).not.toMatch(/text-align:\s*(left|right)\s*;/);
  });

  it('never parks an element off-screen with a negative offset', () => {
    // This is the exact skip-link bug: a huge negative `left` becomes a huge
    // positive overflow the moment the document flips.
    expect(css).not.toMatch(/(left|right|inset-inline-start|inset-inline-end):\s*-\d{3,}/);
  });
});

describe('game.css is exempt from direction rules it cannot follow', () => {
  it('is only used by the standalone canvas page', () => {
    // Documented so nobody "fixes" the game page into RTL: the canvas is a
    // picture, not text, and is deliberately left-to-right in both languages.
    const css = code(read('site.css'));
    expect(css).toMatch(/direction:\s*ltr/);
  });
});
