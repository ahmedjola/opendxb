/**
 * Dubai, as one continuous strip you walk along.
 *
 * Replaces the old six-doors-round-a-plaza district. The city is now a line of
 * real, named areas — Deira at one end, the Marina at the other — laid out in
 * the order they actually come, with the offices sited in the area you would
 * really go to. Walking right takes you down Sheikh Zayed Road.
 *
 * The skyline is a PARALLAX BACKDROP rather than world objects. At walking zoom
 * the viewport is about seven tiles tall, and the Burj Khalifa is six tiles of
 * building — put it in the world and the player can never see the thing the
 * city is famous for. In the backdrop it is always on screen and scrolls slower
 * than the ground, which is also what gives the walk a sense of distance.
 *
 * Nothing here is a survey map, and no landmark is presented as a government
 * office: the offices are fictional and stand apart from the skyline.
 */
import Phaser from 'phaser';
import { OFFICES, getAnswersForOffice } from '../content/loader';
import type { Office } from '../content/types';
import { CONFIRM_CODES, KeyLatch } from '../ui/keyLatch';
import { virtualInput } from '../ui/touchControls';
import {
  DISTRICTS,
  WORLD_TILES,
  arrivalTile,
  districtAt,
  districtForOffice,
  type District,
} from '../world/districts';
import { TILE } from './pixels';
import type { HudScene } from './hud';

const WORLD_W = WORLD_TILES * TILE;

/**
 * The world is only eight tiles tall, and that is deliberate.
 *
 * At walking zoom the viewport is 7.5 tiles. Any taller and the camera scrolls
 * vertically, which drags ground across the top of the screen and buries the
 * skyline behind it. Eight tiles means the camera is effectively locked
 * vertically: the top of the screen is always sky, the bottom is always street.
 */
const WORLD_H_TILES = 8;
const WORLD_H = WORLD_H_TILES * TILE;

/** Nothing is drawn above this line, so the parallax backdrop shows through. */
const HORIZON = 4.2;
/** The walkable band: verge, road, verge. */
const ROAD_TOP = 5;
const ROAD_BOTTOM = 7.2;
/** Offices stand north of the road and face south onto it. */
const OFFICE_BASE = ROAD_TOP;
const OFFICE_H = 3.5 * TILE;

const CAMERA_ZOOM = 2;
const SPEED = 150;
const DOOR_RANGE = 46;

interface DoorMarker {
  office: Office;
  x: number;
  y: number;
}

export class CityScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Image;
  private facing: 'down' | 'up' | 'side' = 'down';
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private doors: DoorMarker[] = [];
  private nearest: DoorMarker | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private latch!: KeyLatch;
  private hud!: HudScene;
  private enterLockedUntil = 0;
  /** Which district the player was in last frame, so crossings can be announced. */
  private currentDistrict: District | null = null;

  constructor() {
    super('CityScene');
  }

  create(data?: { arriveAt?: string }): void {
    this.doors = [];
    this.currentDistrict = null;
    // Bounded to the walkable band, not the whole world: above the road is
    // skyline, and there is no ground up there to stand on.
    this.physics.world.setBounds(
      0,
      (ROAD_TOP - 0.2) * TILE,
      WORLD_W,
      (ROAD_BOTTOM + 0.6 - (ROAD_TOP - 0.2)) * TILE,
    );

    this.scene.launch('BackdropScene');
    // Scenes render in launch order, so without this the sky would be painted
    // over the street it is meant to sit behind.
    this.scene.sendToBack('BackdropScene');
    this.drawGround();

    this.walls = this.physics.add.staticGroup();
    for (const office of OFFICES) this.buildOffice(office);
    this.dressStreet();

    const start = data?.arriveAt
      ? arrivalTile(DISTRICTS.find((d) => d.id === data.arriveAt) ?? (DISTRICTS[2] as District))
      : arrivalTile(DISTRICTS[2] as District);

    this.shadow = this.add.image(0, 0, 'shadow').setDepth(4).setAlpha(0.3);
    this.player = this.physics.add.sprite(start * TILE, 6.2 * TILE, 'player-down-0');
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(12, 8).setOffset(2, 14);
    this.player.setDepth(5);
    this.player.play('stand-down');
    this.physics.add.collider(this.player, this.walls);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.setupInput();
    this.scene.launch('HudScene');
    this.hud = this.scene.get('HudScene') as HudScene;

    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.enterLockedUntil = this.time.now + 350;
      this.scene.wake('HudScene');
      this.hud.refresh();
      this.player.setPosition(this.player.x, (ROAD_TOP + 1.1) * TILE);
      virtualInput.releaseAll();
      virtualInput.consumeConfirm();
      this.latch.clear();
    });
  }

  /* ── ground ────────────────────────────────────────────────────────────── */

  private drawGround(): void {
    const layer = (key: string, ty: number, th: number, depth: number) =>
      this.add
        .tileSprite(0, ty * TILE, WORLD_W, th * TILE, key)
        .setOrigin(0, 0)
        .setDepth(depth);

    // Ground starts at the horizon, never above it: everything above is sky,
    // and that is where the skyline lives.
    layer('ground-sand', HORIZON, WORLD_H_TILES - HORIZON, -20);

    // A haze band right on the horizon, so the ground does not begin on a hard
    // line halfway up the screen.
    const haze = this.add.graphics().setDepth(-19.5);
    haze.fillStyle(0xe8d3a9, 0.55).fillRect(0, HORIZON * TILE, WORLD_W, 10);
    haze.fillStyle(0xc9a876, 0.3).fillRect(0, HORIZON * TILE + 10, WORLD_W, 6);

    layer('ground-grass', ROAD_TOP - 0.5, 0.6, -19);
    layer('ground-grass', ROAD_BOTTOM - 0.1, 0.9, -19);
    layer('ground-paving', ROAD_TOP, ROAD_BOTTOM - ROAD_TOP, -17);

    // Each district gets a wash of its own colour over the paving, so you can
    // tell you have crossed into a new area without reading the banner.
    for (const district of DISTRICTS) {
      this.add
        .rectangle(
          district.x * TILE,
          ROAD_TOP * TILE,
          district.width * TILE,
          (ROAD_BOTTOM - ROAD_TOP) * TILE,
          district.tint,
          0.14,
        )
        .setOrigin(0, 0)
        .setDepth(-16.8);
    }

    this.drawKerbs();
  }

  private drawKerbs(): void {
    const g = this.add.graphics().setDepth(-16.5);
    for (const ty of [ROAD_TOP, ROAD_BOTTOM]) {
      const y = ty * TILE;
      g.fillStyle(0xdcd6c8, 1).fillRect(0, y - 3, WORLD_W, 3);
      g.fillStyle(0x7d7565, 1).fillRect(0, y, WORLD_W, 2);
    }
    // The centre line down the road.
    const dash = this.add.graphics().setDepth(-16.6);
    const midY = ((ROAD_TOP + ROAD_BOTTOM) / 2) * TILE;
    for (let x = 0; x < WORLD_W; x += 48) {
      dash.fillStyle(0xc9a876, 0.4).fillRect(x, midY, 24, 2);
    }
  }

  /* ── buildings ─────────────────────────────────────────────────────────── */

  private buildOffice(office: Office): void {
    const district = districtForOffice(office.id);
    if (!district) return;

    const w = 7 * TILE;
    const h = OFFICE_H;
    const x = (district.x + Math.floor(district.width / 2) - 3) * TILE;
    const y = OFFICE_BASE * TILE - h; // stands on the road's north kerb
    const doorX = x + w / 2;
    const doorY = OFFICE_BASE * TILE;

    const g = this.add.graphics();
    const lit = lighten(office.wall, 0.22);
    const shade = darken(office.wall, 0.22);
    const deep = darken(office.wall, 0.42);

    g.fillStyle(0x000000, 0.25).fillRect(x - 4, doorY - 6, w + 8, 10);
    g.fillStyle(office.wall, 1).fillRect(x, y, w, h);
    g.fillStyle(lit, 1).fillRect(x, y, w, 3);
    g.fillStyle(lit, 1).fillRect(x, y, 3, h);
    g.fillStyle(shade, 1).fillRect(x + w - 4, y, 4, h);
    g.fillStyle(deep, 1).fillRect(x, y + h - 3, w, 3);

    // Sign band across the top, clear of the door below it.
    const SIGN_H = 28;
    g.fillStyle(office.roof, 1).fillRect(x, y, w, SIGN_H);
    g.fillStyle(lighten(office.roof, 0.3), 1).fillRect(x, y, w, 2);
    g.fillStyle(darken(office.roof, 0.35), 1).fillRect(x, y + SIGN_H - 3, w, 3);

    // One band of windows between the sign and the doorway.
    for (let col = 0; col < 5; col += 1) {
      const wx = x + 16 + col * 40;
      const wy = y + SIGN_H + 10;
      g.fillStyle(deep, 1).fillRect(wx - 2, wy - 2, 28, 26);
      g.fillStyle(0x2b5f6e, 1).fillRect(wx, wy, 24, 22);
      g.fillStyle(0x6fc7d4, 0.65).fillRect(wx, wy, 24, 7);
      g.fillStyle(0xdff1f6, 0.5).fillRect(wx + 3, wy + 2, 5, 16);
      g.fillStyle(lit, 1).fillRect(wx - 2, wy + 22, 28, 3);
    }
    g.setDepth(1);

    this.add.image(doorX, doorY, 'door').setOrigin(0.5, 1).setDepth(2);

    // Solid body for the building; the doorway itself is a soft trigger just
    // outside it, so walking up to the door never blocks you.
    const body = this.add.rectangle(x + w / 2, y + h / 2 - 8, w, h - 16);
    this.physics.add.existing(body, true);
    this.walls.add(body);
    body.setVisible(false);

    const label = this.add
      .text(doorX, y + 9, office.nameEn, {
        fontFamily: 'ui-monospace, "DejaVu Sans Mono", monospace',
        fontSize: '9px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(4)
      .setDepth(3);
    label.setShadow(0, 1, '#00000099', 2);

    const count = getAnswersForOffice(office.id).length;
    this.add
      .text(
        doorX,
        y + 20,
        count === 0 ? 'no entries yet' : `${count} question${count === 1 ? '' : 's'}`,
        {
          fontFamily: 'ui-monospace, "DejaVu Sans Mono", monospace',
          fontSize: '7px',
          color: '#e8e2d4',
        },
      )
      .setOrigin(0.5, 0.5)
      .setResolution(4)
      .setDepth(3);

    this.doors.push({ office, x: doorX, y: doorY + 14 });
  }

  /** Planting and passers-by, spread the length of the strip. */
  private dressStreet(): void {
    const place = (key: string, tx: number, ty: number, depth = 4) =>
      this.add
        .image(tx * TILE + TILE / 2, ty * TILE, key)
        .setOrigin(0.5, 1)
        .setDepth(depth);

    for (let tx = 2; tx < WORLD_TILES; tx += 6) {
      place('palm', tx, ROAD_TOP + 0.05, 3);
      place('ghaf', tx + 3, ROAD_BOTTOM + 0.85);
      if (tx % 12 === 2) place('planter', tx + 4, ROAD_BOTTOM + 0.8, 6);
      if (tx % 30 === 20) place('wind-tower', tx + 1, ROAD_TOP + 0.05, 2);
      if (tx % 24 === 14) place('abra', tx, HORIZON + 0.5, 1);
    }

    // Passers-by. They do not move and you cannot talk to them; they are here
    // so a city-length street does not read as evacuated.
    const tints = [0xf2a25c, 0x4fb8ae, 0xd9944a, 0x8f5228, 0x2e8b8b, 0xffd9a0];
    for (let i = 0; i < 30; i += 1) {
      const tx = 4 + i * 6.4;
      if (tx >= WORLD_TILES - 2) break;
      const y = (ROAD_TOP + 0.7 + (i % 3) * 0.55) * TILE;
      const x = tx * TILE;
      this.add.image(x, y + 1, 'shadow').setDepth(4).setAlpha(0.25);
      this.add
        .sprite(x, y, 'player-down-0')
        .setOrigin(0.5, 1)
        .setTint(tints[i % tints.length] as number)
        .setDepth(5 + y / WORLD_H);
    }
  }

  /* ── input ─────────────────────────────────────────────────────────────── */

  private setupInput(): void {
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

  update(): void {
    const left = this.cursors?.left.isDown || this.wasd?.left.isDown || virtualInput.isHeld('left');
    const right =
      this.cursors?.right.isDown || this.wasd?.right.isDown || virtualInput.isHeld('right');
    const up = this.cursors?.up.isDown || this.wasd?.up.isDown || virtualInput.isHeld('up');
    const down = this.cursors?.down.isDown || this.wasd?.down.isDown || virtualInput.isHeld('down');

    const vx = (left ? -1 : 0) + (right ? 1 : 0);
    const vy = (up ? -1 : 0) + (down ? 1 : 0);
    const velocity = new Phaser.Math.Vector2(vx, vy).normalize().scale(SPEED);
    this.player.setVelocity(velocity.x, velocity.y);

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

    this.player.setDepth(5 + this.player.y / WORLD_H);
    this.shadow.setPosition(this.player.x, this.player.y + 10);
    this.shadow.setDepth(this.player.depth - 0.5);

    this.announceCrossing();

    this.nearest = this.findNearestDoor();
    if (this.nearest) {
      this.hud.showPrompt(`${this.nearest.office.nameEn}\nE / Enter to go in`);
    } else {
      this.hud.hidePrompt();
    }

    if (this.latch.pressed('KeyG')) window.open('./guide.html', '_blank', 'noopener');
    if (this.latch.pressed('KeyM')) {
      this.latch.clear();
      this.openMap();
      return;
    }

    const confirmed = this.latch.pressed(...CONFIRM_CODES) || virtualInput.consumeConfirm();
    this.latch.clear();

    if (this.nearest && confirmed && this.time.now >= this.enterLockedUntil) {
      this.enterOffice(this.nearest.office);
    }
  }

  /** Name the area as you walk into it — the only way to know where you are. */
  private announceCrossing(): void {
    const district = districtAt(Math.floor(this.player.x / TILE));
    if (!district || district === this.currentDistrict) return;
    this.currentDistrict = district;
    this.hud.announceDistrict(district);
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
    this.scene.sleep('HudScene');
    this.scene.pause();
    this.scene.launch('OfficeScene', { officeId: office.id });
  }

  private openMap(): void {
    this.player.setVelocity(0, 0);
    this.hud.hidePrompt();
    this.scene.sleep('HudScene');
    this.scene.pause();
    this.scene.launch('MapScene', { at: this.currentDistrict?.id });
  }

  /** Fast travel: drop the player into the middle of the chosen district. */
  travelTo(districtId: string): void {
    const district = DISTRICTS.find((d) => d.id === districtId);
    if (!district) return;
    this.player.setPosition(arrivalTile(district) * TILE, 6.2 * TILE);
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.currentDistrict = null; // force the banner to fire on arrival
  }
}

/** Move a colour towards white. Used for the lit face of a building. */
function lighten(colour: number, amount: number): number {
  return Phaser.Display.Color.ValueToColor(colour).lighten(amount * 100).color;
}

/** Move a colour towards black. Used for shaded flanks and window reveals. */
function darken(colour: number, amount: number): number {
  return Phaser.Display.Color.ValueToColor(colour).darken(amount * 100).color;
}
