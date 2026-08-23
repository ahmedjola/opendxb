import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // The single-file targets ship one page, so links to sibling pages are dead
  // there. Code reads this rather than guessing from the URL.
  define: { __SINGLE_FILE__: false },
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: {
        // The site — the arrival hero, the fork and the journey (the entry point).
        main: here('./index.html'),
        // The game (the delight).
        game: here('./game.html'),
        // The plain, keyboard-navigable HTML guide (the guarantee).
        guide: here('./guide.html'),
      },
    },
  },
  server: { port: 5173, open: false },
});
