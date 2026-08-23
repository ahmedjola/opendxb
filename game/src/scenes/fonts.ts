/**
 * Typefaces for canvas text.
 *
 * Phaser bakes text into a texture using whatever the browser resolves at that
 * moment, and it never repaints when a webfont arrives later. Two consequences
 * this module exists to prevent:
 *
 * 1. `ui-monospace` resolves to SF Mono or Consolas depending on the machine.
 *    Neither carries Arabic, so Arabic set in the mono stack falls back
 *    per-platform and loses its cursive joining — every letter lands on a fixed
 *    monospace advance and the result reads as a rendering fault, not a font
 *    choice. Arabic must never use MONO.
 * 2. Naming the right family is not enough. `awaitFonts()` has to resolve
 *    before the game boots, or the canvas bakes the fallback in permanently.
 */

/** Latin UI text: labels, prompts, key hints. */
export const MONO = 'ui-monospace, "DejaVu Sans Mono", monospace';

/** Anything in Arabic. Never MONO. */
export const ARABIC =
  '"IBM Plex Sans Arabic", "Noto Sans Arabic", "Geeza Pro", "Segoe UI", sans-serif';

/**
 * Arabic needs more vertical room than Latin at the same nominal size.
 *
 * Takes a Latin size in px and returns the Arabic equivalent, so the two never
 * drift apart as sizes are tuned.
 */
export function arabicSize(latinPx: number): string {
  return `${latinPx + 3}px`;
}

/**
 * Wait for the Arabic face before anything is drawn.
 *
 * Resolves rather than rejects if the font never loads: a missing webfont is a
 * degraded game, not a broken one, and blocking the city on it would be worse
 * than the fallback.
 */
export async function awaitFonts(): Promise<void> {
  const fonts = (globalThis as { document?: Document }).document?.fonts;
  if (!fonts?.load) return;
  try {
    await Promise.all([
      fonts.load('16px "IBM Plex Sans Arabic"'),
      fonts.load('600 16px "IBM Plex Sans Arabic"'),
    ]);
  } catch {
    // Nothing to do about it, and it must not stop the game booting.
  }
}
