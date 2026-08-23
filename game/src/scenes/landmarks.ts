/**
 * Dubai's skyline, as pixel sprites.
 *
 * These are the shapes that make a map read as Dubai rather than as a generic
 * city: you should know where you are from the silhouette alone, before you
 * read a single label.
 *
 * Built from width-by-height profiles rather than typed out pixel by pixel — a
 * 200-row tower is not something you hand-author, and a profile is how these
 * buildings are actually shaped: a footprint that steps inward as it rises.
 *
 * All of these are public landmarks drawn as generic silhouettes. No logo,
 * crest, seal, wordmark or official colour scheme appears on any of them, and
 * no building here is presented as a government office — the offices in this
 * game are fictional and stand apart from the skyline.
 */
import Phaser from 'phaser';
import { fillGrid, paint, rect, rng, row, set } from './pixels';

/**
 * Draw a tower from a profile: for each row, how wide the building is there.
 *
 * The lit face, the shaded face and the window grid all follow from the
 * profile, which is what keeps a tall building looking like one solid object
 * instead of a stack of unrelated boxes.
 */
function tower(
  widths: readonly number[],
  colours: { lit: string; body: string; shade: string; glass: string },
  options: { windowStep?: number; windowInset?: number } = {},
): string[] {
  const height = widths.length;
  const maxWidth = Math.max(...widths);
  const W = maxWidth + 2;
  const g = fillGrid('.', W, height);
  const centre = Math.floor(W / 2);
  const step = options.windowStep ?? 4;
  const inset = options.windowInset ?? 2;

  widths.forEach((width, y) => {
    if (width <= 0) return;
    const half = Math.floor(width / 2);
    const left = centre - half;

    row(g, left, y, width, colours.body);
    // Lit edge down the left, shaded edge down the right.
    row(g, left, y, Math.max(1, Math.round(width * 0.22)), colours.lit);
    row(g, left + width - Math.max(1, Math.round(width * 0.28)), y, Math.max(1, Math.round(width * 0.28)), colours.shade);
    // Outline, so the tower separates from whatever is behind it.
    set(g, left - 1, y, 'y');
    set(g, left + width, y, 'y');

    // Window band: a lit row every few pixels, inset from both edges.
    if (width > 6 && y % step === 0) {
      for (let x = left + inset; x < left + width - inset; x += 2) {
        set(g, x, y, colours.glass);
      }
    }
  });

  return g;
}

/**
 * The Burj Khalifa.
 *
 * Its real profile is three lobes around a core, each stepping back in a spiral
 * as it rises, ending in a long spire. Approximated here as a taper with
 * setbacks at the heights the real setbacks fall.
 */
function burjKhalifa(): string[] {
  const widths: number[] = [];
  const spire = 46;
  const shaft = 168;

  // The spire: a needle, most of it a single pixel wide.
  for (let i = 0; i < spire; i += 1) widths.push(i < spire - 14 ? 1 : 3);

  // The shaft. Slim — the real tower is 828m tall on a footprint you could fit
  // in a city block, and a wide base turns it into a Christmas tree. Stepped
  // rather than smoothly tapered, because it is a stack of setbacks and a
  // smooth cone reads as a rocket.
  for (let i = 0; i < shaft; i += 1) {
    const t = i / shaft;
    const smooth = 3 + Math.pow(t, 2.1) * 27;
    const stepped = Math.round(smooth / 3) * 3;
    widths.push(Math.max(3, stepped | 1));
  }

  const g = tower(
    widths,
    { lit: 'm', body: 'n', shade: 'o', glass: 'q' },
    { windowStep: 6, windowInset: 2 },
  );

  // A lit crown where the shaft meets the spire.
  const centre = Math.floor((g[0]?.length ?? 0) / 2);
  for (let y = spire - 5; y < spire + 3; y += 1) set(g, centre, y, 'A');
  return g;
}

/**
 * The Burj Al Arab: a sail on a mast, standing on its own island.
 *
 * The curve is the whole identity of the building — a straight-edged version
 * would read as any hotel — so the leading edge is a real curve stepped into
 * pixels, and the mast is the vertical it leans against.
 */
function burjAlArab(): string[] {
  const H = 132;
  const W = 76;
  const g = fillGrid('.', W, H);
  const mastX = 52;

  for (let y = 0; y < H; y += 1) {
    const t = y / (H - 1);
    // The sail's leading edge sweeps out from the mast as it descends.
    const belly = Math.round(46 * Math.sin(t * Math.PI * 0.62));
    const left = mastX - belly;
    if (left >= mastX) continue;

    row(g, left, y, mastX - left, 'u'); // the sail, white
    row(g, left, y, 2, 'y'); // its outlined leading edge
    row(g, mastX - 6, y, 6, 'w'); // shaded where it meets the mast

    // The exoskeleton: horizontal ribs every eight rows.
    if (y % 8 === 0 && mastX - left > 6) {
      row(g, left + 2, y, mastX - left - 2, 'w');
    }
  }

  // The mast, and the helipad bracket near the top.
  rect(g, mastX, 6, 5, H - 6, 'x');
  rect(g, mastX, 6, 2, H - 6, 'w');
  rect(g, mastX + 5, 6, 1, H - 6, 'y');
  rect(g, mastX + 5, 22, 12, 3, 'x');
  rect(g, mastX + 14, 18, 8, 4, 'n');

  // The island it stands on, and its causeway back to the shore.
  rect(g, mastX - 44, H - 8, 62, 8, 'c');
  rect(g, mastX - 44, H - 8, 62, 2, 'b');
  rect(g, mastX - 2, H - 4, 24, 4, 'd');
  return g;
}

/** The Dubai Frame: a rectangle standing on end, which is the entire point. */
function dubaiFrame(): string[] {
  const W = 62;
  const H = 92;
  const g = fillGrid('.', W, H);

  const post = (x: number) => {
    rect(g, x, 4, 9, H - 4, 'C');
    rect(g, x, 4, 3, H - 4, 'B');
    rect(g, x + 7, 4, 2, H - 4, 'F');
    rect(g, x - 1, 4, 1, H - 4, 'y');
    rect(g, x + 9, 4, 1, H - 4, 'y');
  };
  post(6);
  post(W - 15);

  // The bridge across the top.
  rect(g, 6, 4, W - 12, 9, 'C');
  rect(g, 6, 4, W - 12, 3, 'B');
  rect(g, 6, 11, W - 12, 2, 'F');
  rect(g, 5, 3, W - 10, 1, 'y');

  // The lattice infill, which is what stops it reading as a doorway.
  for (let y = 18; y < H - 6; y += 6) {
    for (let x = 18; x < W - 18; x += 6) set(g, x, y, 'C');
  }
  return g;
}

/** A cluster of Marina towers: many slim buildings at different heights. */
function marinaTowers(): string[] {
  const heights = [96, 132, 74, 148, 88, 118, 62, 104];
  const gap = 3;
  const widths = [16, 20, 14, 18, 15, 19, 13, 17];
  const W = widths.reduce((sum, w) => sum + w + gap, 0);
  const H = Math.max(...heights) + 4;
  const g = fillGrid('.', W, H);
  const rand = rng(0x4d17);

  let x = 0;
  heights.forEach((h, index) => {
    const w = widths[index] as number;
    const top = H - h;
    const body = index % 2 === 0 ? 'n' : 'v';
    const litFace = index % 2 === 0 ? 'm' : 'u';
    const shadeFace = index % 2 === 0 ? 'o' : 'w';

    rect(g, x, top, w, h, body);
    rect(g, x, top, 3, h, litFace);
    rect(g, x + w - 4, top, 4, h, shadeFace);
    rect(g, x - 1, top, 1, h, 'y');
    rect(g, x + w, top, 1, h, 'y');
    rect(g, x, top, w, 1, litFace);

    // Lit windows, scattered rather than a perfect grid — a fully lit tower at
    // dusk looks like a spreadsheet.
    for (let wy = top + 4; wy < H - 4; wy += 4) {
      for (let wx = x + 3; wx < x + w - 3; wx += 3) {
        set(g, wx, wy, rand() > 0.42 ? 'q' : 't');
      }
    }
    x += w + gap;
  });
  return g;
}

/** A wind tower — the Al Fahidi rooftop shape, and the oldest thing here. */
function windTower(): string[] {
  const W = 30;
  const H = 54;
  const g = fillGrid('.', W, H);

  rect(g, 4, 16, 22, H - 16, 'v'); // the house
  rect(g, 4, 16, 4, H - 16, 'u');
  rect(g, 22, 16, 4, H - 16, 'w');
  rect(g, 3, 16, 1, H - 16, 'y');
  rect(g, 26, 16, 1, H - 16, 'y');

  rect(g, 9, 2, 12, 16, 'v'); // the tower itself
  rect(g, 9, 2, 3, 16, 'u');
  rect(g, 18, 2, 3, 16, 'w');
  rect(g, 8, 2, 1, 16, 'y');
  rect(g, 21, 2, 1, 16, 'y');
  rect(g, 7, 0, 16, 3, 'w'); // its capping course
  rect(g, 7, 0, 16, 1, 'u');
  // The slots that catch the wind, which is the whole function of the thing.
  for (const sx of [11, 15, 19]) rect(g, sx, 6, 2, 9, 'z');

  rect(g, 8, 34, 6, 8, 'z'); // a doorway
  rect(g, 17, 32, 5, 5, 'z'); // and a window
  return g;
}

/** An abra — the wooden boat that crosses the Creek for one dirham. */
function abra(): string[] {
  const g = fillGrid('.', 34, 16);
  row(g, 4, 12, 26, 'l');
  row(g, 2, 10, 30, 'k');
  row(g, 3, 11, 28, 'k');
  row(g, 6, 9, 22, 'F');
  rect(g, 12, 4, 10, 5, 'k'); // the canopy
  rect(g, 12, 4, 10, 1, 'B');
  rect(g, 11, 5, 1, 4, 'l');
  rect(g, 22, 5, 1, 4, 'l');
  row(g, 2, 13, 30, 'y');
  return g;
}

export function createLandmarks(scene: Phaser.Scene): void {
  paint(scene, 'burj-khalifa', burjKhalifa());
  paint(scene, 'burj-al-arab', burjAlArab());
  paint(scene, 'dubai-frame', dubaiFrame());
  paint(scene, 'marina-towers', marinaTowers());
  paint(scene, 'wind-tower', windTower());
  paint(scene, 'abra', abra());
}
