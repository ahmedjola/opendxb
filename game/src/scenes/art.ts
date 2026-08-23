/**
 * The world's art, generated at runtime from the pixel maps below.
 *
 * Nothing here is downloaded. Every sprite is authored in this file against the
 * shared palette in `pixels.ts`, and no real-world logo, crest, seal or
 * official colour scheme appears anywhere in it — every office in this game is
 * fictional and looks it.
 *
 * The rule that keeps it looking like one world: shapes get a dark outline, a
 * lit side (top-left) and a shaded side (bottom-right), and a soft shadow on
 * the ground. Flat fills are what made the first pass look like coloured
 * blocks.
 */
import Phaser from 'phaser';
import { TILE, fillGrid, paint, rect, rng, row, set } from './pixels';

export { TILE } from './pixels';

/* ── ground ──────────────────────────────────────────────────────────────── */

/** Sand with wind ripples and grit. Flat sand is the flattest thing there is. */
function sandTile(): string[] {
  const g = fillGrid('b');
  const rand = rng(0x5a17);

  // Long, shallow wind ripples running across the tile.
  for (let i = 0; i < 5; i += 1) {
    const y = Math.floor(rand() * TILE);
    const x = Math.floor(rand() * TILE);
    const len = 6 + Math.floor(rand() * 10);
    row(g, x, y, len, 'a');
    row(g, x + 1, y + 1, len - 2, 'c');
  }
  // Grit.
  for (let i = 0; i < 26; i += 1) {
    set(g, Math.floor(rand() * TILE), Math.floor(rand() * TILE), rand() > 0.5 ? 'c' : 'a');
  }
  for (let i = 0; i < 6; i += 1) {
    set(g, Math.floor(rand() * TILE), Math.floor(rand() * TILE), 'd');
  }
  return g;
}

/** Scrubby desert grass — the green a Dubai roadside actually is, irrigated. */
function grassTile(): string[] {
  const g = fillGrid('h');
  const rand = rng(0x2c93);

  for (let i = 0; i < 40; i += 1) {
    set(g, Math.floor(rand() * TILE), Math.floor(rand() * TILE), 'i');
  }
  // Tufts: three pixels leaning, which is enough to read as a blade of grass.
  for (let i = 0; i < 14; i += 1) {
    const x = 1 + Math.floor(rand() * (TILE - 2));
    const y = 2 + Math.floor(rand() * (TILE - 3));
    set(g, x, y, 'g');
    set(g, x, y - 1, 'g');
    set(g, x + (rand() > 0.5 ? 1 : -1), y - 2, 'g');
  }
  for (let i = 0; i < 8; i += 1) {
    set(g, Math.floor(rand() * TILE), Math.floor(rand() * TILE), 'j');
  }
  return g;
}

/** Interlock paving — the block paving every Dubai plaza and pavement uses. */
function pavingTile(): string[] {
  const g = fillGrid('n');
  const rand = rng(0x77a1);

  // Four courses per tile, each brick 16x8, offset course to course like real
  // interlock. Two big bricks per tile read as a giant floor, not a pavement.
  for (let course = 0; course < 4; course += 1) {
    const y = course * 8;
    row(g, 0, y, TILE, 'p'); // mortar line
    row(g, 0, y + 1, TILE, 'm'); // lit top of the brick
    const offset = course % 2 === 0 ? 0 : 8;
    for (let x = offset; x < TILE; x += 16) {
      rect(g, x, y + 1, 1, 7, 'p');
    }
  }
  for (let i = 0; i < 34; i += 1) {
    set(g, Math.floor(rand() * TILE), Math.floor(rand() * TILE), rand() > 0.6 ? 'o' : 'm');
  }
  return g;
}

/** Tilled soil, in rows, like the reference farms. Used for planted beds. */
function soilTile(): string[] {
  const g = fillGrid('e');
  const rand = rng(0x31f4);
  for (let x = 0; x < TILE; x += 8) {
    rect(g, x, 0, 3, TILE, 'f'); // furrow
    rect(g, x + 3, 0, 1, TILE, 'd'); // lit ridge
  }
  for (let i = 0; i < 22; i += 1) {
    set(g, Math.floor(rand() * TILE), Math.floor(rand() * TILE), rand() > 0.5 ? 'f' : 'd');
  }
  return g;
}

/** A pool of water, for the plaza fountain. */
function waterTile(): string[] {
  const g = fillGrid('r');
  const rand = rng(0x9b02);
  for (let i = 0; i < 10; i += 1) {
    const x = Math.floor(rand() * TILE);
    const y = Math.floor(rand() * TILE);
    row(g, x, y, 3 + Math.floor(rand() * 5), 'q');
  }
  for (let i = 0; i < 14; i += 1) {
    set(g, Math.floor(rand() * TILE), Math.floor(rand() * TILE), 's');
  }
  return g;
}

/* ── props ───────────────────────────────────────────────────────────────── */

/**
 * A date palm, the tree Dubai actually plants along every road.
 *
 * Fronds arch down from a crown rather than sticking out sideways, the trunk
 * carries the diamond scarring a date palm has, and there is a shadow at the
 * base so it sits on the ground instead of floating over it.
 */
const PALM = [
  '.............jjj.............',
  '..........jjjhhhjjj..........',
  '.......jjjhhhgggghhhjjj......',
  '....jjjhhhgg..gg..gghhhjjj...',
  '..jjhhhgg....ggg....gghhhjj..',
  '.jhhgg.....gghhhgg.....gghhj.',
  'jhgg......ghhhhhhhg......gghj',
  'hg.......ghhh.j.hhhg.......gh',
  'g.......ghhj..j..jhhg.......g',
  '.......ghhj...j...jhhg.......',
  '......ghhj....j....jhhg......',
  '.....jhhj.....j.....jhhj.....',
  '.....jhj......j......jhj.....',
  '......j......klk......j......',
  '............kkllk............',
  '............klkkl............',
  '...........kklkkl............',
  '...........klkklk............',
  '...........kklkkl............',
  '...........klkklk............',
  '...........kklkkl............',
  '..........kklkklk............',
  '..........klkkllk............',
  '.........kkklkkllk...........',
  '........yykklkkllkyy.........',
  '......yyyyyyyyyyyyyyyy.......',
];

/** A ghaf — the UAE's national tree. Low, wide, umbrella-shaped. */
const GHAF = [
  '.....jjjjjjjjj.....',
  '..jjjhhhhhhhhhjjj..',
  '.jhhhgggghhgggghhhj',
  'jhhggghhhhhhhggghhj',
  'jhgghhhiiiiihhhgghj',
  '.jhhhiii.k.iiihhhj.',
  '..jjhii..k..iihjj..',
  '.......k.k.k.......',
  '........klk........',
  '........klk........',
  '........klk........',
  '.......kkllk.......',
  '......kkkllkk......',
  '.....yyyklkyyy.....',
  '.....yyyyyyyyy.....',
];

/** A low planter of flowering shrubs, the kind that line every Dubai kerb. */
const PLANTER = [
  '..gg..hg..gg..',
  '.ghhg.gh.ghhg.',
  'ghBhg.hh.ghBhg',
  '.ghhgghhgghhg.',
  '..ihhhhhhhhi..',
  '.iiihhhhhhiii.',
  'xxxxxxxxxxxxxx',
  'xwwwwwwwwwwwwx',
  'xwvvvvvvvvvvwx',
  'xwvvvvvvvvvvwx',
  'xwwwwwwwwwwwwx',
  'yyyyyyyyyyyyyy',
];

/** A hoarding-style fence panel, waist high. */
const FENCE = [
  'yyyyyyyyyyyyyyyy',
  'ykkkkkkkkkkkkkky',
  'ylllllllllllllly',
  'y..............y',
  'ykkkkkkkkkkkkkky',
  'ylllllllllllllly',
  'y..............y',
  'yk............ky',
  'yl............ly',
  'yl............ly',
  '.y............y.',
];

/**
 * An office door: glass, a frame, a step and an awning.
 *
 * Deliberately generic — no crest, no seal, no logo, nothing that could be
 * mistaken for a real government building's frontage.
 */
const DOOR = [
  'CCCCCCCCCCCCCCCCCCCCCCCC',
  'CBBBBBBBBBBBBBBBBBBBBBBC',
  'CBAAAAAAAAAAAAAAAAAAAABC',
  'CBBBBBBBBBBBBBBBBBBBBBBC',
  'yCCCCCCCCCCCCCCCCCCCCCCy',
  'y......................y',
  'yxxxxxxxxxxxxxxxxxxxxxxy',
  'xDDDDDDDDDDxxDDDDDDDDDDx',
  'xDqqqqqqqqDxxDqqqqqqqqDx',
  'xDqrrrrrrqDxxDqrrrrrrqDx',
  'xDqrrrrrrqDxxDqrrrrrrqDx',
  'xDqrrrrrrqDxxDqrrrrrrqDx',
  'xDqrrrrrrqDxxDqrrrrrrqDx',
  'xDqrrrrrrqDMMDqrrrrrrqDx',
  'xDqrrrrrrqDxxDqrrrrrrqDx',
  'xDqrrrrrrqDxxDqrrrrrrqDx',
  'xDqrrrrrrqDxxDqrrrrrrqDx',
  'xDDDDDDDDDDxxDDDDDDDDDDx',
  'yxxxxxxxxxxxxxxxxxxxxxxy',
  'ynnnnnnnnnnnnnnnnnnnnnny',
  'yooooooooooooooooooooooy',
  'yyyyyyyyyyyyyyyyyyyyyyyy',
];

/* ── the player ──────────────────────────────────────────────────────────── */

/**
 * The player, 16x22, drawn facing four ways with a two-frame walk.
 *
 * Deliberately unremarkable: a person in a light shirt with a bag. Not a
 * knight, not an official, nobody in uniform. The whole premise is that this
 * is you, on your first week, carrying a folder of documents.
 */
function person(face: 'down' | 'up' | 'side', step: 0 | 1): string[] {
  const g = fillGrid('.', 16, 22);

  // Hair and head
  rect(g, 5, 1, 6, 2, 'z');
  rect(g, 4, 2, 8, 3, 'z');
  if (face === 'up') {
    rect(g, 4, 3, 8, 5, 'z'); // back of the head — no face
    rect(g, 5, 8, 6, 1, 'H');
  } else {
    rect(g, 5, 4, 6, 4, 'G');
    rect(g, 4, 4, 1, 4, 'I'); // shaded cheek
    rect(g, 11, 4, 1, 4, 'I');
    if (face === 'down') {
      set(g, 6, 6, 'z');
      set(g, 9, 6, 'z');
      row(g, 7, 8, 2, 'I'); // mouth line
    } else {
      set(g, 9, 6, 'z'); // one eye in profile
      rect(g, 4, 3, 6, 5, 'z'); // hair swept across
      rect(g, 10, 4, 2, 4, 'G');
    }
  }
  rect(g, 4, 1, 8, 1, 'y'); // outline over the hair

  // Torso — light shirt, shaded on the right.
  rect(g, 4, 9, 8, 7, 'M');
  rect(g, 10, 9, 2, 7, 'v');
  rect(g, 3, 9, 1, 7, 'y');
  rect(g, 12, 9, 1, 7, 'y');
  rect(g, 4, 8, 8, 1, 'y');

  // A document folder, because that is the entire subject of this game.
  rect(g, 11, 11, 4, 5, 'B');
  rect(g, 11, 12, 4, 1, 'A');
  rect(g, 11, 16, 4, 1, 'C');

  // Arms
  rect(g, 2, 10, 2, 5, 'M');
  rect(g, 2, 15, 2, 2, 'G');
  if (face !== 'up') {
    rect(g, 12, 10, 1, 4, 'v');
  }

  // Legs, alternating on the walk cycle.
  const leftY = step === 0 ? 16 : 17;
  const rightY = step === 0 ? 17 : 16;
  rect(g, 5, leftY, 3, 22 - leftY - 1, 'J');
  rect(g, 8, rightY, 3, 22 - rightY - 1, 'K');
  rect(g, 5, 21, 3, 1, 'z');
  rect(g, 8, 21, 3, 1, 'z');

  return g;
}


/**
 * The plaza fountain, as a sprite.
 *
 * Drawn rather than filled with `fillEllipse`, which anti-aliases: one smooth
 * curve in a pixel scene reads as a rendering bug, and it was the most
 * obviously wrong thing on screen.
 */
function fountain(): string[] {
  const W = 96;
  const H = 56;
  const g = fillGrid('.', W, H);
  const cx = W / 2;
  const cy = H / 2 + 2;

  // Concentric flattened discs, each stepped a pixel row at a time.
  const disc = (rx: number, ry: number, oy: number, ch: string) => {
    for (let y = -ry; y <= ry; y += 1) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
      row(g, cx - half, cy + y + oy, half * 2, ch);
    }
  };

  disc(46, 15, 3, 'p'); // ground shadow under the rim
  disc(46, 15, 0, 'o'); // outer rim, shaded
  disc(45, 14, -1, 'n');
  disc(43, 13, -2, 'm'); // lit top of the rim
  disc(38, 11, -1, 't'); // water, deep edge
  disc(37, 10, -2, 's');
  disc(36, 10, -2, 'r'); // water
  // A highlight off to one side, so the surface reads as wet.
  for (let y = -4; y <= 0; y += 1) {
    const half = Math.floor(16 * Math.sqrt(Math.max(0, 1 - ((y + 2) / 4) ** 2)));
    row(g, cx - 18 - half / 2, cy + y - 6, half, 'q');
  }

  // The spout in the middle.
  rect(g, cx - 4, cy - 20, 8, 20, 'm');
  rect(g, cx + 2, cy - 20, 3, 20, 'o');
  rect(g, cx - 5, cy - 21, 10, 1, 'n');
  return g;
}

/** A stepped, hard-edged shadow. Same reason as the fountain: no anti-aliasing. */
function shadowBlob(): string[] {
  const g = fillGrid('.', 20, 7);
  row(g, 5, 0, 10, 'z');
  row(g, 2, 1, 16, 'z');
  row(g, 1, 2, 18, 'z');
  row(g, 1, 3, 18, 'z');
  row(g, 2, 4, 16, 'z');
  row(g, 5, 5, 10, 'z');
  return g;
}

/* ── build ───────────────────────────────────────────────────────────────── */

export function createArt(scene: Phaser.Scene): void {
  paint(scene, 'ground-sand', sandTile());
  paint(scene, 'ground-grass', grassTile());
  paint(scene, 'ground-paving', pavingTile());
  paint(scene, 'ground-soil', soilTile());
  paint(scene, 'water', waterTile());

  paint(scene, 'palm', PALM);
  paint(scene, 'ghaf', GHAF);
  paint(scene, 'planter', PLANTER);
  paint(scene, 'fence', FENCE);
  paint(scene, 'door', DOOR);

  for (const face of ['down', 'up', 'side'] as const) {
    paint(scene, `player-${face}-0`, person(face, 0));
    paint(scene, `player-${face}-1`, person(face, 1));
  }

  paint(scene, 'fountain', fountain());
  paint(scene, 'shadow', shadowBlob());
}

/** Walk cycles, one per facing, plus a standing frame for each. */
export function createPlayerAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists('walk-down')) return;
  for (const face of ['down', 'up', 'side'] as const) {
    scene.anims.create({
      key: `walk-${face}`,
      frames: [{ key: `player-${face}-0` }, { key: `player-${face}-1` }],
      frameRate: 7,
      repeat: -1,
    });
    scene.anims.create({
      key: `stand-${face}`,
      frames: [{ key: `player-${face}-0` }],
      frameRate: 1,
    });
  }
}
