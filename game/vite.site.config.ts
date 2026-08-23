import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Build the whole experience — site and city — as ONE self-contained HTML file.
 *
 * Separate from the normal build because it is a different target, not a
 * different setting: a published artifact runs under a strict CSP with no
 * network egress, so nothing can be fetched at runtime. Phaser, the content and
 * the styles all have to be inside the file. The normal multi-entry build stays
 * as-is for a static host, where separate assets are correct.
 *
 * `inlineDynamicImports` is what makes the city work here. The overlay imports
 * Phaser lazily so a reader who only wants their visa steps never downloads a
 * game engine — but a lazy import becomes a separate chunk, and a separate
 * chunk is a network fetch that this target cannot make. Rollup folds it back
 * into the one bundle; `import()` still resolves, it just resolves instantly.
 */
export default defineConfig({
  // The single-file targets ship one page, so links to sibling pages are dead
  // there. Code reads this rather than guessing from the URL.
  define: { __SINGLE_FILE__: true },
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2022',
    outDir: 'dist-site',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      input: here('./index.html'),
      output: { inlineDynamicImports: true },
    },
  },
});
