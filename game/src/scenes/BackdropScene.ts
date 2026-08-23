/**
 * Sky, sun and skyline, behind the city.
 *
 * Its own scene for the same reason the HUD is: a camera zoom does not just
 * scale what it draws, it re-centres it. A `setScrollFactor(0)` object at world
 * y=0 lands 240 pixels above the top of a 2x-zoomed viewport, which is how the
 * sky ended up drawn almost entirely off-screen. An unzoomed scene underneath
 * the city gets 1:1 pixels and exact control.
 *
 * Parallax is driven manually from the city camera's scroll: three layers at
 * three speeds, which is what gives an eighty-kilometre strip a sense of
 * distance while you walk it.
 */
import Phaser from 'phaser';
import { DISTRICTS } from '../world/districts';
import { TILE } from './pixels';

/** Must match the city camera. */
const ZOOM = 2;
/** Where the ground meets the sky, in screen pixels. */
const HORIZON = 236;

/** How fast each layer scrolls relative to the street. Nearer = faster. */
const FAR = 0.16;
const NEAR = 0.34;
const SUN = 0.03;

export class BackdropScene extends Phaser.Scene {
  private far!: Phaser.GameObjects.Container;
  private near!: Phaser.GameObjects.Container;
  private sun!: Phaser.GameObjects.Container;

  constructor() {
    super('BackdropScene');
  }

  create(): void {
    const { width } = this.scale;

    // Sky: a dusk gradient, filling everything above the horizon.
    const sky = this.add.graphics();
    const bands: [number, number][] = [
      [0x241d38, 0],
      [0x3d2b4e, 0.22],
      [0x6b3f57, 0.44],
      [0xa85a52, 0.63],
      [0xd98a52, 0.81],
      [0xe8b06a, 0.93],
    ];
    bands.forEach(([colour, stop], index) => {
      const next = bands[index + 1]?.[1] ?? 1;
      sky.fillStyle(colour, 1).fillRect(0, HORIZON * stop, width, HORIZON * (next - stop) + 2);
    });

    this.sun = this.add.container(0, 0);
    const sun = this.add.graphics();
    // Stepped, not a smooth circle: one anti-aliased curve in a pixel scene
    // reads as a rendering bug.
    const cx = width * 0.68;
    const cy = HORIZON * 0.78;
    for (let dy = -26; dy <= 26; dy += 2) {
      const half = Math.round(30 * Math.sqrt(Math.max(0, 1 - (dy / 26) ** 2)));
      sun.fillStyle(0xffd9a0, 0.9).fillRect(cx - half, cy + dy, half * 2, 2);
    }
    this.sun.add(sun);

    this.far = this.add.container(0, 0);
    this.far.add(this.buildFarSkyline());

    this.near = this.add.container(0, 0);
    for (const district of DISTRICTS) {
      if (!district.landmark) continue;
      const worldX = (district.x + district.width / 2) * TILE;
      this.near.add(
        this.add.image(worldX * ZOOM * NEAR, HORIZON + 4, district.landmark).setOrigin(0.5, 1),
      );
    }
  }

  /** Anonymous towers along the horizon, so it is never empty between areas. */
  private buildFarSkyline(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const last = DISTRICTS.at(-1);
    const span = ((last?.x ?? 0) + (last?.width ?? 0)) * TILE * ZOOM * FAR;

    // Deterministic: a skyline that reshuffles between loads reads as a bug.
    let seed = 0x51d3;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let x = -400; x < span + 800; x += 11) {
      const h = 16 + Math.floor(next() * 78);
      const w = 8 + Math.floor(next() * 12);
      g.fillStyle(0x3a3550, 1).fillRect(x, HORIZON + 6 - h, w, h);
      g.fillStyle(0x4c4569, 1).fillRect(x, HORIZON + 6 - h, 2, h);
      g.fillStyle(0x2b2740, 1).fillRect(x + w - 2, HORIZON + 6 - h, 2, h);
      if (next() > 0.5) g.fillStyle(0x8a7aa8, 1).fillRect(x + 3, HORIZON + 11 - h, 2, 2);
    }
    return g;
  }

  update(): void {
    const city = this.scene.get('CityScene');
    if (!city?.cameras?.main) return;
    const camera = city.cameras.main;
    // The camera's centre in world coordinates. Anchoring on the centre rather
    // than the scroll edge is what keeps a landmark over its own district.
    const centreX = camera.scrollX + camera.width / camera.zoom / 2;
    const half = this.scale.width / 2;

    this.sun.x = half - centreX * ZOOM * SUN;
    this.far.x = half - centreX * ZOOM * FAR;
    this.near.x = half - centreX * ZOOM * NEAR;
  }
}
