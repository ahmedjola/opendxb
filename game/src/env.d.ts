/// <reference types="vite/client" />

/**
 * True when this bundle is the one-file build.
 *
 * That target has no sibling `guide.html` or `game.html`, so anything linking
 * to them has to fall back to something that exists in the same file.
 */
declare const __SINGLE_FILE__: boolean;
