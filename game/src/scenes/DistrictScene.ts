import Phaser from 'phaser';
import { DISCLAIMER, OFFICES, getAnswersForOffice } from '../content/loader';
import type { Office } from '../content/types';
import { CONFIRM_CODES, KeyLatch } from '../ui/keyLatch';
import { virtualInput } from '../ui/touchControls';
import { TILE } from './art';

const WORLD_W_TILES = 46;
const WORLD_H_TILES = 30;
const WORLD_W = WORLD_W_TILES * TILE;
const WORLD_H = WORLD_H_TILES * TILE;

const OFFICE_W_TILES = 6;
const OFFICE_H_TILES = 5;

const SPEED = 130;
const DOOR_RANGE = 44;

interface DoorMarker {
  office: Office;
  x: number;
  y: number;
}

/** The walkable district: six fictional offices around a paved plaza. */
export class DistrictScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private doors: DoorMarker[] = [];
  private nearest: DoorMarker | null = null;
  private prompt!: Phaser.GameObjects.Text;
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

    this.add.tileSprite(0, 0, WORLD_W, WORLD_H, 'ground-sand').setOrigin(0, 0).setDepth(-20);
    this.drawPaving();

    this.walls = this.physics.add.staticGroup();
    for (const office of OFFICES) this.buildOffice(office);
    this.scatterPlants();

    this.player = this.physics.add.sprite(WORLD_W / 2, WORLD_H / 2, 'player-a');
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(12, 10).setOffset(2, 14);
    this.player.setDepth(5);
    this.player.play('stand');
    this.physics.add.collider(this.player, this.walls);

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.setupInput();
    this.buildHud();

    // Coming back out of an office: nudge the player off the door and hold the
    // "enter" key for a beat so they don't bounce straight back in.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.enterLockedUntil = this.time.now + 350;
      // Step back the way we came in, so we don't stand on the trigger.
      const exitDir = this.player.y < WORLD_H / 2 ? 1 : -1;
      this.player.setPosition(this.player.x, this.player.y + exitDir * 12);
      virtualInput.releaseAll();
      virtualInput.consumeConfirm();
      this.latch.clear();
    });
  }

  private drawPaving(): void {
    const band = (tx: number, ty: number, tw: number, th: number) =>
      this.add
        .tileSprite(tx * TILE, ty * TILE, tw * TILE, th * TILE, 'ground-paving')
        .setOrigin(0, 0)
        .setDepth(-19);

    band(0, 13, WORLD_W_TILES, 4); // main plaza street
    band(7, 9, 3, 4); // approaches to the north offices
    band(22, 9, 3, 4);
    band(37, 9, 3, 4);
    band(7, 17, 3, 5); // approaches to the south offices
    band(22, 17, 3, 5);
    band(37, 17, 3, 5);
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

    const g = this.add.graphics();
    g.fillStyle(office.wall, 1).fillRect(x, y, w, h);
    g.fillStyle(office.roof, 1).fillRect(x, signY, w, SIGN_H);
    g.fillStyle(0x000000, 0.18).fillRect(x, y + h - 6, w, 6);

    // Windows: plain rectangles. No emblem, crest or signage of any kind.
    const windowTop = southFacing ? y + SIGN_H + 12 : y + 14;
    g.fillStyle(0xdff1f6, 0.75);
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        g.fillRect(x + 18 + col * 42, windowTop + row * 40, 24, 22);
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

  private scatterPlants(): void {
    const spots: [number, number][] = [
      [3, 12], [14, 12], [17, 12], [30, 12], [33, 12], [44, 12],
      [3, 18], [14, 18], [17, 18], [30, 18], [33, 18], [44, 18],
    ];
    for (const [tx, ty] of spots) {
      this.add.image(tx * TILE + TILE / 2, ty * TILE + TILE, 'palm').setOrigin(0.5, 1).setDepth(4);
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
    const { width, height } = this.scale;

    this.add
      .rectangle(0, 0, width, 20, 0x14130f, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.add
      .text(width / 2, 10, DISCLAIMER, {
        fontFamily: 'ui-monospace, "DejaVu Sans Mono", monospace',
        fontSize: '11px',
        color: '#ffe9a8',
      })
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setResolution(2)
      .setDepth(101);

    this.prompt = this.add
      .text(width / 2, height - 22, '', {
        fontFamily: 'ui-monospace, "DejaVu Sans Mono", monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#14130fdd',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setResolution(2)
      .setDepth(101)
      .setVisible(false);
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

    if (vx !== 0) this.player.setFlipX(vx < 0);
    const moving = vx !== 0 || vy !== 0;
    if (moving && this.player.anims.currentAnim?.key !== 'walk') this.player.play('walk');
    if (!moving && this.player.anims.currentAnim?.key !== 'stand') this.player.play('stand');

    // Depth-sort the player against the buildings so walking "behind" reads right.
    this.player.setDepth(5 + this.player.y / WORLD_H);

    this.nearest = this.findNearestDoor();
    if (this.nearest) {
      this.prompt.setText(`E / Enter — ${this.nearest.office.nameEn}`).setVisible(true);
    } else {
      this.prompt.setVisible(false);
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
    this.prompt.setVisible(false);
    this.scene.pause();
    this.scene.launch('OfficeScene', { officeId: office.id });
  }
}
