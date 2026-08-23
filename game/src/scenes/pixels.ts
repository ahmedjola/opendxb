/**
 * A tiny pixel-art authoring layer.
 *
 * The art used to be `fillRect` calls, which is why it looked like coloured
 * blocks: you cannot shade, dither or outline a sprite you are describing as
 * rectangles. Here sprites are written the way pixel artists actually draw
 * them — a grid of characters, one character per pixel, against a named
 * palette. `.` is transparent.
 *
 * Everything is still generated at runtime from source in this repo. There are
 * no downloaded assets, no third-party spritesheets, and no real-world logo,
 * crest, seal or official colour scheme anywhere in it.
 */
import Phaser from 'phaser';

export const TILE = 32;

/**
 * One palette for the whole world, so nothing looks pasted in from elsewhere.
 *
 * Ramps are three to four steps (light → base → shade → line) because that is
 * what makes a shape read as lit rather than flat. Desert daylight, not the
 * green-hill palette every RPG tileset ships with.
 */
export const PAL: Record<string, number | null> = {
  '.': null, // transparent

  // Sand and dirt
  a: 0xe8d3a9, // sand light
  b: 0xd9bf8f, // sand
  c: 0xc4a877, // sand shade
  d: 0xa8895c, // sand line
  e: 0x8a6b45, // earth
  f: 0x6f5334, // earth shade

  // Growing things
  g: 0x7fb04a, // leaf light
  h: 0x5d9138, // leaf
  i: 0x406b28, // leaf shade
  j: 0x2b4a1c, // leaf line
  k: 0x8f6b3f, // bark
  l: 0x6b4c29, // bark shade

  // Stone, paving, concrete
  m: 0xdcd6c8, // stone light
  n: 0xc3bcab, // stone
  o: 0xa49c8b, // stone shade
  p: 0x7d7565, // stone line

  // Water
  q: 0x6fc7d4, // water light
  r: 0x3f9fb4, // water
  s: 0x2b7c92, // water shade
  t: 0x1d5a6b, // water line

  // Buildings
  u: 0xf2e4cd, // wall light
  v: 0xe0cfb2, // wall
  w: 0xc2ad8c, // wall shade
  x: 0x8f7a5c, // wall line
  y: 0x3d3a34, // outline
  z: 0x24221e, // darkest

  // Accents — the site's own palette, so the game and the page match
  A: 0xffd9a0, // accent light
  B: 0xf2a25c, // accent
  C: 0xd9944a, // accent deep
  D: 0x4fb8ae, // teal light
  E: 0x2e8b8b, // teal
  F: 0x8f5228, // brown

  // People
  G: 0xf0c8a0, // skin light
  H: 0xd9a878, // skin
  I: 0xb5835a, // skin shade
  J: 0x3b3f52, // cloth dark
  K: 0x5a6178, // cloth
  L: 0xffffff, // white
  M: 0xe8e4dc, // off white
};

/**
 * Turn rows of characters into a texture, one character per pixel.
 *
 * Rows are trimmed of leading indentation so sprite maps can be written inline
 * at whatever indent the surrounding code sits at. Every row must end up the
 * same width — a ragged sprite is a typo, and silently drawing it makes the
 * mistake very hard to find later.
 */
export function paint(scene: Phaser.Scene, key: string, rows: readonly string[]): void {
  if (scene.textures.exists(key)) return;
  const grid = rows.map((row) => row.trim());
  const width = grid[0]?.length ?? 0;
  for (const [index, row] of grid.entries()) {
    if (row.length !== width) {
      throw new Error(`Sprite "${key}" row ${index} is ${row.length}px, expected ${width}px`);
    }
  }

  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const [y, row] of grid.entries()) {
    let x = 0;
    while (x < width) {
      const ch = row[x] as string;
      const colour = PAL[ch];
      if (colour === null || colour === undefined) {
        x += 1;
        continue;
      }
      // Runs of the same colour become one fill. Meaningful: a 32x32 tile is
      // 1024 potential fills, and every sprite is rebuilt on every scene boot.
      let run = 1;
      while (x + run < width && row[x + run] === ch) run += 1;
      g.fillStyle(colour, 1);
      g.fillRect(x, y, run, 1);
      x += run;
    }
  }
  g.generateTexture(key, width, Math.max(grid.length, 1));
  g.destroy();
}

/**
 * A deterministic pseudo-random source.
 *
 * Ground detail is scattered, not placed by hand, but it must land in the same
 * place on every load — grass that reshuffles itself on reload reads as a bug.
 */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Build a solid tile of characters, ready to have detail written into it. */
export function fillGrid(ch: string, w = TILE, h = TILE): string[] {
  return Array.from({ length: h }, () => ch.repeat(w));
}

/** Write one pixel into a grid built by `fillGrid`. Out-of-bounds is ignored. */
export function set(grid: string[], x: number, y: number, ch: string): void {
  const row = grid[y];
  if (row === undefined || x < 0 || x >= row.length) return;
  grid[y] = row.slice(0, x) + ch + row.slice(x + 1);
}

/** Write a horizontal run. Cheaper and far more readable than a pixel loop. */
export function row(grid: string[], x: number, y: number, len: number, ch: string): void {
  for (let i = 0; i < len; i += 1) set(grid, x + i, y, ch);
}

/** Write a filled rectangle. */
export function rect(
  grid: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  ch: string,
): void {
  for (let dy = 0; dy < h; dy += 1) row(grid, x, y + dy, w, ch);
}
