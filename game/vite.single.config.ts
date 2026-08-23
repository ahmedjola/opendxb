import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Build the GAME as ONE self-contained HTML file.
 *
 * This is `game.html`, not the site: the landing page pulls its typefaces from
 * Google Fonts, and a single-file artifact under a strict CSP has no network
 * egress to fetch them. The game has no external dependency at all, so it is
 * the page that can honestly be inlined into one file.
 *
 * Separate from the normal build because it is a different target, not a
 * different setting: a published artifact runs under a strict CSP with no
 * network egress, so nothing can be fetched at runtime — Phaser, the content
 * and the styles all have to be inside the file. The normal multi-entry build
 * stays as-is for GitHub Pages, where separate assets are correct.
 */
export default defineConfig({
  // The single-file targets ship one page, so links to sibling pages are dead
  // there. Code reads this rather than guessing from the URL.
  define: { __SINGLE_FILE__: true },
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2022',
    outDir: 'dist-single',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { input: here('./game.html') },
  },
});
