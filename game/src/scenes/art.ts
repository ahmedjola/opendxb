/**
 * Placeholder pixel art, drawn at runtime with Phaser's Graphics API.
 *
 * Everything here is hand-drawn rectangles. There are no downloaded assets, no
 * third-party sprites, and no real-world logos, crests, seals or official
 * colour schemes anywhere in this project.
 */
import Phaser from 'phaser';

export const TILE = 32;

export const PALETTE = {
  sand: 0xd9c39a,
  sandDark: 0xc9b184,
  paving: 0xb9b0a0,
  pavingLine: 0xa79d8c,
  skin: 0xe8b98c,
  hair: 0x3a2b20,
  shirt: 0x2f7f9e,
  trousers: 0x35404f,
  shoes: 0x241f1b,
  trunk: 0x7a5b39,
  frond: 0x4c7f4a,
  planter: 0x9a6b4f,
  doorFrame: 0x2b2b2b,
  doorPanel: 0xf0d98a,
} as const;

type G = Phaser.GameObjects.Graphics;

function draw(scene: Phaser.Scene, key: string, w: number, h: number, fn: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  fn(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function px(g: G, x: number, y: number, w: number, h: number, colour: number): void {
  g.fillStyle(colour, 1);
  g.fillRect(x, y, w, h);
}

/** Deterministic speckle so the ground doesn't shimmer between reloads. */
function speckle(g: G, seed: number, count: number, size: number, colour: number): void {
  let s = seed;
  for (let i = 0; i < count; i += 1) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const x = s % TILE;
    s = (s * 1103515245 + 12345) % 2147483648;
    const y = s % TILE;
    px(g, x, y, size, size, colour);
  }
}

function drawPerson(g: G, shirt: number): void {
  // 16 x 24 little person, seen from above-behind.
  px(g, 4, 0, 8, 6, PALETTE.hair); // hair
  px(g, 5, 4, 6, 4, PALETTE.skin); // face
  px(g, 3, 8, 10, 9, shirt); // torso
  px(g, 1, 9, 2, 6, shirt); // arms
  px(g, 13, 9, 2, 6, shirt);
  px(g, 4, 17, 3, 5, PALETTE.trousers); // legs
  px(g, 9, 17, 3, 5, PALETTE.trousers);
}

export function createArt(scene: Phaser.Scene): void {
  draw(scene, 'ground-sand', TILE, TILE, (g) => {
    px(g, 0, 0, TILE, TILE, PALETTE.sand);
    speckle(g, 7, 18, 2, PALETTE.sandDark);
  });

  draw(scene, 'ground-paving', TILE, TILE, (g) => {
    px(g, 0, 0, TILE, TILE, PALETTE.paving);
    px(g, 0, 0, TILE, 2, PALETTE.pavingLine);
    px(g, 0, 0, 2, TILE, PALETTE.pavingLine);
    px(g, 0, TILE / 2, TILE, 1, PALETTE.pavingLine);
  });

  draw(scene, 'player-a', 16, 24, (g) => {
    drawPerson(g, PALETTE.shirt);
    px(g, 4, 22, 3, 2, PALETTE.shoes);
    px(g, 9, 22, 3, 2, PALETTE.shoes);
  });

  draw(scene, 'player-b', 16, 24, (g) => {
    drawPerson(g, PALETTE.shirt);
    px(g, 3, 22, 4, 2, PALETTE.shoes); // stride
    px(g, 10, 21, 3, 2, PALETTE.shoes);
  });

  draw(scene, 'palm', 24, 36, (g) => {
    px(g, 10, 12, 4, 24, PALETTE.trunk);
    px(g, 2, 8, 20, 4, PALETTE.frond);
    px(g, 6, 4, 12, 4, PALETTE.frond);
    px(g, 0, 12, 6, 3, PALETTE.frond);
    px(g, 18, 12, 6, 3, PALETTE.frond);
  });

  draw(scene, 'planter', 20, 20, (g) => {
    px(g, 2, 10, 16, 10, PALETTE.planter);
    px(g, 4, 2, 12, 8, PALETTE.frond);
  });

  draw(scene, 'door', 26, 30, (g) => {
    px(g, 0, 0, 26, 30, PALETTE.doorFrame);
    px(g, 3, 4, 20, 26, PALETTE.doorPanel);
    px(g, 12, 4, 2, 26, PALETTE.doorFrame);
  });
}

/** Two-frame walk cycle shared by every scene that shows the player. */
export function createPlayerAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists('walk')) return;
  scene.anims.create({
    key: 'walk',
    frames: [{ key: 'player-a' }, { key: 'player-b' }],
    frameRate: 6,
    repeat: -1,
  });
  scene.anims.create({ key: 'stand', frames: [{ key: 'player-a' }], frameRate: 1 });
}
