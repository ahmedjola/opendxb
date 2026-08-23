import Phaser from 'phaser';
import { OFFICES, getAnswersForOffice } from '../content/loader';
import type { Office } from '../content/types';
import { CONFIRM_CODES, KeyLatch } from '../ui/keyLatch';
import type { HudScene } from './hud';
import { virtualInput } from '../ui/touchControls';
import { TILE } from './art';

const WORLD_W_TILES = 44;
const WORLD_H_TILES = 24;
const WORLD_W = WORLD_W_TILES * TILE;
const WORLD_H = WORLD_H_TILES * TILE;

const OFFICE_W_TILES = 6;
const OFFICE_H_TILES = 5;

/** How close the camera sits. 2 puts the player at roughly the reference scale. */
const CAMERA_ZOOM = 2;

const SPEED = 130;
const DOOR_RANGE = 44;

/** Move a colour towards white. Used for the lit face of a building. */
function lighten(colour: number, amount: number): number {
  return Phaser.Display.Color.ValueToColor(colour).lighten(amount * 100).color;
}

/** Move a colour towards black. Used for shaded flanks and window reveals. */
function darken(colour: number, amount: number): number {
  return Phaser.Display.Color.ValueToColor(colour).darken(amount * 100).color;
}

interface DoorMarker {
  office: Office;
  x: number;
  y: number;
}

/** The walkable district: six fictional offices around a paved plaza. */
export class DistrictScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  /** Which way the player last faced. Kept so they don't snap back on stopping. */
  private facing: 'down' | 'up' | 'side' = 'down';
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private doors: DoorMarker[] = [];
  private nearest: DoorMarker | null = null;
  private hud!: HudScene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private latch!: KeyLatch;
  private enterLockedUntil = 0;

  constructor() {
    super('DistrictScene');
  }

  create(): void {
    this.doors = [];
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

    this.drawGround();

    this.walls = this.physics.add.staticGroup();
    for (const office of OFFICES) this.buildOffice(office);
    this.drawFountain();
    this.scatterPlants();
    this.addPassersBy();

    // A soft shadow under the player, so they stand on the ground rather than
    // hover over it. Its own sprite, following in update(), because the player
    // is depth-sorted and the shadow must always sit below them.
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(4).setAlpha(0.3);

    this.player = this.physics.add.sprite(WORLD_W / 2, WORLD_H / 2, 'player-down-0');
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(12, 8).setOffset(2, 14);
    this.player.setDepth(5);
    this.player.play('stand-down');
    this.physics.add.collider(this.player, this.walls);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setRoundPixels(true);
    // Close in. At 1:1 a 640x480 viewport shows twenty tiles of street and the
    // whole thing reads as a map rather than a place you are standing in.
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.setupInput();
    this.buildHud();
    // The HUD boots a frame later, so anything that reads from it waits.
    this.scene.get('HudScene').events.once(Phaser.Scenes.Events.CREATE, () => {
      this.markObjectiveOffice();
    });

    // Coming back out of an office: nudge the player off the door and hold the
    // "enter" key for a beat so they don't bounce straight back in.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.enterLockedUntil = this.time.now + 350;
      this.scene.wake('HudScene');
      // Progress may have moved while they were inside.
      this.hud.refresh();
      // Step back the way we came in, so we don't stand on the trigger.
      const exitDir = this.player.y < WORLD_H / 2 ? 1 : -1;
      this.player.setPosition(this.player.x, this.player.y + exitDir * 12);
      virtualInput.releaseAll();
      virtualInput.consumeConfirm();
      this.latch.clear();
    });
  }

  /**
   * The ground, in layers: sand everywhere, grass verges along the street,
   * paving where people walk, planted beds in the gaps.
   *
   * Layering rather than a single tile is what stops it reading as a flat
   * field — the eye needs the edges between materials to believe it is a place.
   */
  private drawGround(): void {
    const layer = (
      key: string,
      tx: number,
      ty: number,
      tw: number,
      th: number,
      depth: number,
    ) =>
      this.add
        .tileSprite(tx * TILE, ty * TILE, tw * TILE, th * TILE, key)
        .setOrigin(0, 0)
        .setDepth(depth);

    layer('ground-sand', 0, 0, WORLD_W_TILES, WORLD_H_TILES, -20);

    // Grass verges either side of the street.
    layer('ground-grass', 0, 11, WORLD_W_TILES, 2, -19);
    layer('ground-grass', 0, 15, WORLD_W_TILES, 2, -19);

    // Planted beds in the gaps between the office approaches.
    for (const [tx, ty, tw, th] of [
      [12, 11, 6, 2],
      [26, 11, 6, 2],
      [12, 15, 6, 2],
      [26, 15, 6, 2],
    ] as const) {
      layer('ground-soil', tx, ty, tw, th, -18);
      this.plantRows(tx, ty, tw, th);
    }

    // The street itself, over the verges so it has a crisp edge.
    layer('ground-paving', 0, 12, WORLD_W_TILES, 4, -17);
    // Approaches up to each office door.
    for (const tx of [7, 22, 35]) {
      layer('ground-paving', tx, 11, 3, 2, -17);
      layer('ground-paving', tx, 15, 3, 2, -17);
    }
    this.drawKerbs();
  }

  /**
   * A raised kerb where the paving meets the grass.
   *
   * Two pixel rows of stone and one of shadow. Without it the two materials
   * butt together on a hard line and the street reads as a texture swap rather
   * than a step down onto a road.
   */
  private drawKerbs(): void {
    const g = this.add.graphics().setDepth(-16.5);
    for (const ty of [12, 16]) {
      const y = ty * TILE;
      const top = ty === 12;
      g.fillStyle(0xdcd6c8, 1).fillRect(0, top ? y - 3 : y - 3, WORLD_W, 3);
      g.fillStyle(0x7d7565, 1).fillRect(0, top ? y : y, WORLD_W, 2);
      if (!top) {
        g.fillStyle(0x000000, 0.14).fillRect(0, y + 2, WORLD_W, 3);
      }
    }
  }

  /**
   * The plaza fountain — the thing every Dubai public space is built around.
   *
   * Purely scenery: no collision, so nobody can get stuck behind it.
   */
  private drawFountain(): void {
    const cx = (WORLD_W_TILES / 2) * TILE;
    const cy = 14 * TILE;

    this.add.image(cx, cy, 'fountain').setDepth(-16);

    // The plume rises and falls. Small, slow, and it does not run at all for
    // anyone who has asked their browser to stop animating things.
    const plume = this.add.rectangle(cx, cy - 34, 4, 14, 0x6fc7d4).setDepth(-15.5);
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      this.tweens.add({
        targets: plume,
        y: cy - 40,
        scaleY: 1.35,
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /**
   * Passers-by. They do not move and you cannot talk to them — they are here so
   * the street does not read as evacuated.
   */
  private addPassersBy(): void {
    const people: [number, number, number][] = [
      [10, 13.4, 0xf2a25c],
      [17, 12.6, 0x4fb8ae],
      [28, 13.8, 0xd9944a],
      [38, 12.8, 0x8f5228],
      [6, 15.4, 0x2e8b8b],
      [31, 15.2, 0xffd9a0],
    ];
    for (const [tx, ty, tint] of people) {
      const x = tx * TILE;
      const y = ty * TILE;
      this.add.image(x, y + 1, 'shadow').setDepth(4).setAlpha(0.25);
      this.add
        .sprite(x, y, 'player-down-0')
        .setOrigin(0.5, 1)
        .setTint(tint)
        .setDepth(5 + y / WORLD_H);
    }
  }

  /** Little sprouts in the tilled beds, on a fixed grid so they look planted. */
  private plantRows(tx: number, ty: number, tw: number, th: number): void {
    for (let row = 0; row < th; row += 1) {
      for (let col = 0; col < tw; col += 1) {
        // Skip every third one, so the rows have gaps like a real bed.
        if ((row * tw + col) % 3 === 2) continue;
        const x = (tx + col) * TILE + TILE / 2;
        const y = (ty + row) * TILE + TILE / 2;
        const sprout = this.add.graphics().setDepth(-17.5);
        sprout.fillStyle(0x5d9138, 1);
        sprout.fillRect(x - 1, y - 4, 2, 5);
        sprout.fillRect(x - 4, y - 5, 3, 2);
        sprout.fillRect(x + 2, y - 6, 3, 2);
      }
    }
  }

  private buildOffice(office: Office): void {
    const x = office.x * TILE;
    const y = office.y * TILE;
    const w = OFFICE_W_TILES * TILE;
    const h = OFFICE_H_TILES * TILE;

    // North-row offices face south onto the plaza; south-row offices face north
    // onto it. `outward` points from the wall into the open street.
    const southFacing = office.y < WORLD_H_TILES / 2;
    const outward = southFacing ? 1 : -1;
    const doorX = x + w / 2;
    const doorY = southFacing ? y + h : y;
    // The sign band always goes on the wall opposite the door, so the two never
    // sit on top of each other.
    const SIGN_H = 46;
    const signY = southFacing ? y : y + h - SIGN_H;

    // The facade, built up in bands rather than filled flat: a lit top edge, a
    // body, a shaded skirt and a ground shadow. Flat rectangles are exactly
    // what made the first pass look like coloured blocks.
    const g = this.add.graphics();
    const lit = lighten(office.wall, 0.22);
    const shade = darken(office.wall, 0.22);
    const deep = darken(office.wall, 0.42);

    g.fillStyle(0x000000, 0.22).fillRect(x - 4, y + h - 4, w + 8, 10); // cast shadow
    g.fillStyle(office.wall, 1).fillRect(x, y, w, h);
    g.fillStyle(lit, 1).fillRect(x, y, w, 3); // sun on the top edge
    g.fillStyle(lit, 1).fillRect(x, y, 3, h); // and down the left
    g.fillStyle(shade, 1).fillRect(x + w - 4, y, 4, h); // shaded right flank
    g.fillStyle(shade, 1).fillRect(x, y + h - 10, w, 10); // skirt
    g.fillStyle(deep, 1).fillRect(x, y + h - 3, w, 3);

    // A vertical pilaster every other bay, which is what gives a facade rhythm.
    for (let col = 0; col <= 4; col += 1) {
      const px = x + 8 + col * ((w - 16) / 4);
      g.fillStyle(lit, 0.5).fillRect(px, y + 4, 2, h - 14);
      g.fillStyle(deep, 0.35).fillRect(px + 2, y + 4, 1, h - 14);
    }

    // The sign band, with its own parapet edge.
    g.fillStyle(office.roof, 1).fillRect(x, signY, w, SIGN_H);
    g.fillStyle(lighten(office.roof, 0.3), 1).fillRect(x, signY, w, 2);
    g.fillStyle(darken(office.roof, 0.35), 1).fillRect(x, signY + SIGN_H - 3, w, 3);

    // Windows: recessed, glazed, with a reflection streak. No emblem, crest or
    // signage of any kind appears on any building in this game.
    const windowTop = southFacing ? y + SIGN_H + 14 : y + 16;
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const wx = x + 18 + col * 42;
        const wy = windowTop + row * 40;
        g.fillStyle(deep, 1).fillRect(wx - 2, wy - 2, 28, 26); // reveal
        g.fillStyle(0x2b5f6e, 1).fillRect(wx, wy, 24, 22); // glass
        g.fillStyle(0x6fc7d4, 0.65).fillRect(wx, wy, 24, 7); // sky reflection
        g.fillStyle(0xdff1f6, 0.5).fillRect(wx + 3, wy + 2, 5, 16); // streak
        g.fillStyle(lit, 1).fillRect(wx - 2, wy + 22, 28, 3); // sill
      }
    }
    g.setDepth(1);

    const door = this.add.image(doorX, doorY, 'door').setDepth(2);
    door.setOrigin(0.5, southFacing ? 1 : 0);

    // Solid body for the building itself; the doorway is a soft trigger just
    // outside it, so walking up to the door never blocks you.
    const body = this.add.rectangle(x + w / 2, y + h / 2, w, h);
    this.physics.add.existing(body, true);
    this.walls.add(body);
    body.setVisible(false);

    const label = this.add
      .text(doorX, signY + 15, office.nameEn, {
        fontFamily: 'ui-monospace, "DejaVu Sans Mono", monospace',
        fontSize: '13px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2)
      .setDepth(3);
    label.setShadow(0, 1, '#00000099', 2);

    // Entry count goes on the facade, under the name, so it can never collide
    // with the player standing on the doorstep.
    const count = getAnswersForOffice(office.id).length;
    this.add
      .text(
        doorX,
        signY + 33,
        count === 0 ? 'no entries yet' : `${count} question${count === 1 ? '' : 's'}`,
        {
          fontFamily: 'ui-monospace, "DejaVu Sans Mono", monospace',
          fontSize: '11px',
          color: '#e8e2d4',
        },
      )
      .setOrigin(0.5, 0.5)
      .setResolution(2)
      .setDepth(3);

    this.doors.push({ office, x: doorX, y: doorY + outward * 10 });
  }

  /**
   * Street planting. Three species and a few benches rather than one palm
   * repeated twelve times — repetition at a fixed pitch is what makes a scene
   * read as tiled.
   */
  private scatterPlants(): void {
    const place = (key: string, tx: number, ty: number, depth = 4) =>
      this.add
        .image(tx * TILE + TILE / 2, ty * TILE + TILE, key)
        .setOrigin(0.5, 1)
        .setDepth(depth);

    // Palms line the street at a wide pitch.
    for (const tx of [2, 11, 19, 29, 39, 43]) {
      place('palm', tx, 11.9);
      place('palm', tx + 2, 17.9);
    }
    // Ghafs fill between them, lower and wider.
    for (const tx of [6, 15, 25, 34, 41]) {
      place('ghaf', tx, 11.9);
      place('ghaf', tx - 2, 17.9);
    }
    // Planters right up against the kerb.
    for (const tx of [4, 13, 27, 37] as const) {
      place('planter', tx, 12, 3);
      place('planter', tx + 2, 17.9, 3);
    }
    // Fencing along the planted beds, so they read as enclosed.
    for (const [tx, ty, count] of [
      [12, 11.2, 6],
      [26, 11.2, 6],
      [12, 17.2, 6],
      [26, 17.2, 6],
    ] as const) {
      for (let i = 0; i < count; i += 1) place('fence', tx + i, ty, 3);
    }
  }

  private setupInput(): void {
    // Constructed unconditionally: it tolerates a missing keyboard plugin, and
    // update() can then rely on it always being there.
    this.latch = new KeyLatch(this);
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private buildHud(): void {
    // Launched in parallel, not added to this scene: see the note in hud.ts
    // about camera zoom scaling pinned objects.
    this.scene.launch('HudScene');
    this.hud = this.scene.get('HudScene') as HudScene;
  }

  /**
   * Put a bobbing marker over the office that holds the player's next step.
   *
   * Without it the district is six identical-looking doors and the player has
   * no reason to walk towards any particular one.
   */
  private markObjectiveOffice(): void {
    const wanted = new Set(this.hud.currentAnswerIds());
    if (wanted.size === 0) return;

    const target = this.doors.find((door) =>
      getAnswersForOffice(door.office.id).some((answer) => wanted.has(answer.id)),
    );
    if (!target) return;

    const marker = this.add.graphics().setDepth(20);
    marker.fillStyle(0xf2a25c, 1);
    // A stepped chevron pointing down at the door.
    marker.fillRect(-10, 0, 20, 4);
    marker.fillRect(-7, 4, 14, 4);
    marker.fillRect(-4, 8, 8, 4);
    marker.fillRect(-1, 12, 2, 4);
    marker.setPosition(target.x, target.y - 54);

    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    this.tweens.add({
      targets: marker,
      y: target.y - 46,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  update(): void {
    const left =
      this.cursors?.left.isDown || this.wasd?.left.isDown || virtualInput.isHeld('left');
    const right =
      this.cursors?.right.isDown || this.wasd?.right.isDown || virtualInput.isHeld('right');
    const up = this.cursors?.up.isDown || this.wasd?.up.isDown || virtualInput.isHeld('up');
    const down = this.cursors?.down.isDown || this.wasd?.down.isDown || virtualInput.isHeld('down');

    const vx = (left ? -1 : 0) + (right ? 1 : 0);
    const vy = (up ? -1 : 0) + (down ? 1 : 0);
    const velocity = new Phaser.Math.Vector2(vx, vy).normalize().scale(SPEED);
    this.player.setVelocity(velocity.x, velocity.y);

    // Sideways wins over vertical when both are held: a diagonal walk reads
    // better in profile than it does from behind.
    if (vx !== 0) {
      this.facing = 'side';
      this.player.setFlipX(vx < 0);
    } else if (vy < 0) {
      this.facing = 'up';
      this.player.setFlipX(false);
    } else if (vy > 0) {
      this.facing = 'down';
      this.player.setFlipX(false);
    }

    const moving = vx !== 0 || vy !== 0;
    const wanted = `${moving ? 'walk' : 'stand'}-${this.facing}`;
    if (this.player.anims.currentAnim?.key !== wanted) this.player.play(wanted);

    // Depth-sort the player against the buildings so walking "behind" reads right.
    this.player.setDepth(5 + this.player.y / WORLD_H);
    this.shadow.setPosition(this.player.x, this.player.y + 10);
    this.shadow.setDepth(this.player.depth - 0.5);

    this.nearest = this.findNearestDoor();
    if (this.nearest) {
      this.hud.showPrompt(`${this.nearest.office.nameEn}\nE / Enter to go in`);
    } else {
      this.hud.hidePrompt();
    }

    if (this.latch.pressed('KeyG')) window.open('./guide.html', '_blank', 'noopener');

    const confirmed = this.latch.pressed(...CONFIRM_CODES) || virtualInput.consumeConfirm();
    this.latch.clear();

    if (this.nearest && confirmed && this.time.now >= this.enterLockedUntil) {
      this.enterOffice(this.nearest.office);
    }
  }

  private findNearestDoor(): DoorMarker | null {
    let best: DoorMarker | null = null;
    let bestDistance = DOOR_RANGE;
    for (const door of this.doors) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
      if (distance < bestDistance) {
        best = door;
        bestDistance = distance;
      }
    }
    return best;
  }

  private enterOffice(office: Office): void {
    this.player.setVelocity(0, 0);
    this.hud.hidePrompt();
    // The HUD is the district's, not the office's — left awake it drew over
    // the office panel.
    this.scene.sleep('HudScene');
    this.scene.pause();
    this.scene.launch('OfficeScene', { officeId: office.id });
  }
}
