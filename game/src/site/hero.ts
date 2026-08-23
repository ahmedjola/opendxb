/**
 * The arrival scene: the view out of a plane window, descending over Dubai at
 * golden hour, drawn as inline SVG with `shape-rendering: crispEdges` so every
 * edge lands on a pixel boundary. No image files, no external requests.
 *
 * It is a mood, not a map. The city below is invented geometry — generic
 * towers, a generic waterway, a generic street grid. No logo, crest, seal or
 * official colour scheme appears anywhere in it.
 */

const W = 320;
const H = 180;
/** Where the sky stops and the city starts. */
const HORIZON = 96;

/** Deterministic noise, so the skyline is the same on every render. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const parts: string[] = [];

function push(markup: string): void {
  parts.push(markup);
}

function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  opacity?: number,
  extra = '',
): void {
  const o = opacity === undefined ? '' : ` opacity="${opacity}"`;
  push(
    `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" fill="${fill}"${o}${extra ? ' ' + extra : ''}/>`,
  );
}

function poly(points: string, fill: string, opacity?: number): void {
  const o = opacity === undefined ? '' : ` opacity="${opacity}"`;
  push(`<polygon points="${points}" fill="${fill}"${o}/>`);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ── 1. Sky: banded sunset gradient ────────────────────────────────────── */

const SKY_BANDS: readonly [string, number][] = [
  ['#1A1220', 14],
  ['#241A2A', 12],
  ['#2E2036', 10],
  ['#3A2C3F', 9],
  ['#48304A', 8],
  ['#5A3A50', 7],
  ['#6E4250', 6],
  ['#874B47', 6],
  ['#A15A3E', 6],
  ['#B96A3C', 5],
  ['#CE7E3E', 5],
  ['#D9944A', 4],
  ['#E8A957', 2],
  ['#F2A25C', 1],
  ['#FFD9A0', 1],
];

function drawSky(): void {
  let y = 0;
  for (const [fill, height] of SKY_BANDS) {
    rect(0, y, W, height, fill);
    y += height;
  }
  // Fill any rounding gap down to the horizon.
  if (y < HORIZON) rect(0, y, W, HORIZON - y, '#FFD9A0');
}

/* ── 1b. High cloud and the first stars ───────────────────────────────── */

function drawSkyDetail(): void {
  const random = rng(31337);

  // First stars, only in the deep part of the sky.
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(random() * W);
    const y = Math.floor(random() * 34);
    rect(x, y, 1, 1, '#EFE3D6', 0.12 + random() * 0.35);
  }

  // Thin high cloud, lit from underneath.
  const bands: [number, number, number][] = [
    [18, 26, 54],
    [96, 34, 38],
    [212, 30, 46],
    [40, 52, 70],
    [178, 58, 62],
    [8, 72, 44],
    [140, 78, 58],
    [244, 84, 50],
  ];
  for (const [bx, by, bw] of bands) {
    const shade = by < 45 ? '#4B3348' : by < 70 ? '#6E4250' : '#874B47';
    const lit = by < 45 ? '#8F5228' : by < 70 ? '#B36236' : '#CE7E3E';
    rect(bx, by, bw, 2, shade, 0.75);
    rect(bx + 2, by + 2, bw - 5, 1, lit, 0.6);
    rect(bx + Math.floor(bw * 0.3), by - 1, Math.floor(bw * 0.4), 1, shade, 0.5);
  }
}

/* ── 2. Sun on the horizon ─────────────────────────────────────────────── */

function drawSun(): void {
  const cx = 214;
  const cy = HORIZON - 3;
  // A blocky disc: symmetric half-widths per row, so it reads as pixel art.
  const halves = [5, 8, 10, 11, 12, 13, 13, 14, 14, 14, 14, 14, 13, 13, 12, 11, 10, 8, 5];
  const top = cy - Math.floor(halves.length / 2);

  // Warm haze around it.
  rect(cx - 34, HORIZON - 22, 68, 22, '#F2A25C', 0.16);
  rect(cx - 22, HORIZON - 14, 44, 14, '#FFD9A0', 0.14);

  halves.forEach((half, i) => {
    const y = top + i;
    if (y >= HORIZON) return;
    const fill = i < 6 ? '#FFD9A0' : i < 13 ? '#FFE3B8' : '#F2A25C';
    rect(cx - half, y, half * 2, 1, fill);
  });

  // Horizon glow spreading sideways.
  rect(0, HORIZON - 3, W, 3, '#D9944A', 0.35);
  rect(0, HORIZON - 1, W, 1, '#F2A25C', 0.55);
}

/* ── 3. Skyline: towers against the sky, with scattered lit windows ────── */

function drawSkyline(): void {
  const random = rng(20260823);

  // Far, hazy row.
  for (let x = 0; x < W; x += 4 + Math.floor(random() * 5)) {
    const h = 4 + Math.floor(random() * 16);
    const w = 3 + Math.floor(random() * 4);
    rect(x, HORIZON - h, w, h, '#3A2C3F', 0.55);
  }

  // Near row: solid silhouettes.
  const towers: { x: number; w: number; h: number }[] = [];
  let x = -2;
  while (x < W) {
    const w = 5 + Math.floor(random() * 9);
    const h = 8 + Math.floor(random() * 26);
    towers.push({ x, w, h });
    x += w + 2 + Math.floor(random() * 6);
  }
  // One tapered standout, so the skyline has a spine.
  towers.push({ x: 148, w: 7, h: 54 });
  towers.push({ x: 150, w: 3, h: 66 });

  for (const t of towers) {
    rect(t.x, HORIZON - t.h, t.w, t.h, '#1B1420');
    // Sun-facing edge catches the light.
    rect(t.x + t.w - 1, HORIZON - t.h, 1, t.h, '#8F5228', 0.5);

    // Scattered lit windows.
    for (let wy = HORIZON - t.h + 2; wy < HORIZON - 1; wy += 3) {
      for (let wx = t.x + 1; wx < t.x + t.w - 1; wx += 2) {
        const roll = random();
        if (roll > 0.72) {
          const warm = roll > 0.93;
          rect(wx, wy, 1, 1, warm ? '#FFD9A0' : '#E8C89A', warm ? 0.95 : 0.6);
        }
      }
    }
  }
}

/* ── 4. The city below, seen from above ────────────────────────────────── */

function drawGround(): void {
  rect(0, HORIZON, W, H - HORIZON, '#171020');
  // Distance haze fading into the horizon.
  rect(0, HORIZON, W, 10, '#8F5228', 0.28);
  rect(0, HORIZON, W, 5, '#D9944A', 0.2);
  // Foreground gets darker as it comes closer.
  rect(0, 150, W, H - 150, '#120E16', 0.55);
}

/** Perspective street grid, glowing sodium-orange from above. */
function drawStreetGrid(): void {
  const vanishX = 168;
  const rows = [99, 102, 106, 111, 117, 124, 132, 142, 154, 168, 180];
  rows.forEach((y, i) => {
    rect(0, y, W, 1, '#E8C89A', 0.05 + i * 0.012);
  });

  // Verticals fanning out from the vanishing point: crispEdges renders these
  // slivers as staircases, which is exactly the look we want.
  for (let i = -13; i <= 13; i++) {
    const spread = i * 26;
    const topX = vanishX + i * 5.5;
    const bottomX = vanishX + spread;
    poly(
      `${round(topX)},${HORIZON} ${round(topX + 0.8)},${HORIZON} ${round(bottomX + 2)},${H} ${round(bottomX)},${H}`,
      '#E8C89A',
      0.07,
    );
  }

  // Traffic and window light, scattered along the grid.
  const random = rng(77);
  for (let i = 0; i < 190; i++) {
    const y = HORIZON + 2 + Math.floor(random() * (H - HORIZON - 4));
    const depth = (y - HORIZON) / (H - HORIZON);
    const gx = Math.floor(random() * W);
    const size = depth > 0.62 ? 2 : 1;
    const roll = random();
    const fill = roll > 0.88 ? '#FFD9A0' : roll > 0.55 ? '#E8C89A' : '#C9A876';
    rect(gx, y, size, 1, fill, 0.25 + depth * 0.5);
  }

  // A few blocks of low buildings catching the last light.
  const blocks = rng(4242);
  for (let i = 0; i < 34; i++) {
    const y = HORIZON + 4 + Math.floor(blocks() * 66);
    const bx = Math.floor(blocks() * W);
    const bw = 4 + Math.floor(blocks() * 12);
    const bh = 2 + Math.floor(blocks() * 5);
    rect(bx, y, bw, bh, '#241A2A', 0.75);
    rect(bx, y, bw, 1, '#8F5228', 0.35);
  }
}

/** The creek, winding through the city and holding the sunset. */
function drawCreek(): void {
  const top =
    '0,168 26,160 52,157 74,150 96,140 120,132 148,124 176,118 204,112 236,106 268,102 300,99 320,98';
  const bottom =
    '320,102 300,104 268,108 236,113 204,120 176,127 148,134 120,143 96,152 74,162 52,170 26,175 0,180';
  poly(`${top} ${bottom}`, '#1D4A52');
  poly(`${top} ${bottom}`, '#2E8B8B', 0.45);

  // Sun sitting on the water.
  const random = rng(909);
  for (let i = 0; i < 70; i++) {
    const t = random();
    const x = Math.round(t * W);
    const y = Math.round(168 - t * 68 + (random() - 0.5) * 7);
    const roll = random();
    rect(
      x,
      y,
      1 + Math.floor(random() * 3),
      1,
      roll > 0.7 ? '#FFD9A0' : roll > 0.4 ? '#D9944A' : '#4FB8AE',
      0.3 + random() * 0.5,
    );
  }
}

/* ── 5. The wing, in the foreground ────────────────────────────────────── */

function drawWing(): void {
  // The wing sweeps most of the way across the window, the way it does from a
  // seat over the trailing edge. Anchored to the bottom-left so a narrow phone
  // viewport still keeps it in frame, and kept several steps lighter than the
  // ground so it stays a readable silhouette under the page's scrim.
  const body = '-10,184 -10,136 44,141 132,156 206,169 244,179 246,184';
  poly(body, '#332640');
  // Upper surface catching what is left of the sun.
  poly('-10,136 44,141 132,156 206,169 244,179 244,184 232,184 200,173 130,160 43,145 -10,141', '#4A3554');
  poly('-10,136 44,141 132,156 206,169 244,179 243,181 205,171 131,158 43,143 -10,138', '#C9A876', 0.75);
  poly('-10,136 44,141 132,156 206,169 244,179 244,180 205,170 131,157 43,142 -10,137', '#FFD9A0', 0.5);
  // Trailing half falls into its own shadow.
  poly('-10,184 -10,162 44,167 132,175 214,183 214,184', '#241A2A');

  // Flap seams and a spoiler panel.
  poly('-10,152 40,157 118,169 118,170 40,158 -10,153', '#1B1420', 0.9);
  poly('-10,168 34,172 82,180 82,181 34,173 -10,169', '#1B1420', 0.9);
  rect(8, 144, 24, 6, '#241A2A', 0.9);
  rect(8, 144, 24, 1, '#8F5228', 0.6);

  // Winglet at the tip.
  poly('244,179 254,158 259,159 250,180', '#332640');
  poly('254,158 259,159 258,162 253,161', '#C9A876', 0.7);

  // Navigation light.
  rect(255, 157, 2, 2, '#4FB8AE', 0.95);
  rect(253, 155, 6, 6, '#4FB8AE', 0.22);
}

/* ── Assemble ──────────────────────────────────────────────────────────── */

function build(): string {
  parts.length = 0;
  drawSky();
  drawSkyDetail();
  drawSun();
  drawSkyline();
  drawGround();
  drawCreek();
  drawStreetGrid();
  drawWing();
  return parts.join('');
}

/**
 * The whole scene as one inline `<svg>` string.
 * `slice` keeps it filling the viewport at any aspect ratio, anchored to the
 * BOTTOM (`YMax`) so a tall phone crops the empty upper sky rather than the
 * city and the wing, which are the parts worth seeing.
 */
export function heroSvg(): string {
  return (
    `<svg class="hero-art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" ` +
    `role="img" aria-label="Pixel art: the view from a plane window, descending over a city at sunset. ` +
    `A banded orange sky, the sun on the horizon, tower silhouettes with lit windows, a winding creek ` +
    `and a glowing street grid below, and the aircraft wing in the foreground." ` +
    `focusable="false">${build()}</svg>`
  );
}

export const HERO_VIEWBOX = { width: W, height: H, horizon: HORIZON };
