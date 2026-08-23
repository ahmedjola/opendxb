/**
 * The map screen: where you are, what is where, and fast travel.
 *
 * Dubai is eighty kilometres of city and walking the whole strip is a chore
 * after the first time. Press M, pick an area, arrive. The map also answers the
 * question the walk cannot: which area is the office for my next step in?
 *
 * This is a stylised strip, not a survey map, and it says so on the screen.
 */
import Phaser from 'phaser';
import { getAnswersForOffice, getOffice } from '../content/loader';
import { CONFIRM_CODES, KeyLatch } from '../ui/keyLatch';
import { virtualInput } from '../ui/touchControls';
import { DISTRICTS, WORLD_TILES, type District } from '../world/districts';
import { readObjective } from '../site/objective';

const MONO = 'ui-monospace, "DejaVu Sans Mono", monospace';
const INK = 0x1b1420;
const EDGE = 0x3a2c3f;
const ACCENT = 0xf2a25c;

export class MapScene extends Phaser.Scene {
  private index = 0;
  private latch!: KeyLatch;
  private layer!: Phaser.GameObjects.Container;
  /** District ids holding the player's next step, highlighted on the strip. */
  private objectiveDistricts = new Set<string>();

  constructor() {
    super('MapScene');
  }

  create(data?: { at?: string }): void {
    const startIndex = DISTRICTS.findIndex((d) => d.id === data?.at);
    this.index = startIndex >= 0 ? startIndex : 0;
    this.objectiveDistricts = this.findObjectiveDistricts();

    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, 0x120e16, 0.96).setOrigin(0, 0);

    this.add
      .text(width / 2, 26, 'DUBAI', {
        fontFamily: MONO,
        fontSize: '20px',
        color: '#ffd9a0',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);
    this.add
      .text(width / 2, 48, 'a stylised strip, not a survey map · north-east to south-west', {
        fontFamily: MONO,
        fontSize: '10px',
        color: '#8a7a8f',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);

    this.layer = this.add.container(0, 0);
    this.latch = new KeyLatch(this);
    this.render();
  }

  /**
   * Which districts hold the answers for the player's current step.
   *
   * This is the map's real job: not "where is everything", but "where do I have
   * to go next".
   */
  private findObjectiveDistricts(): Set<string> {
    const wanted = new Set(readObjective().step?.answerIds ?? []);
    if (wanted.size === 0) return new Set();

    const found = new Set<string>();
    for (const district of DISTRICTS) {
      for (const officeId of district.offices) {
        if (getAnswersForOffice(officeId).some((answer) => wanted.has(answer.id))) {
          found.add(district.id);
        }
      }
    }
    return found;
  }

  private render(): void {
    const { width, height } = this.scale;
    this.layer.removeAll(true);

    /* ── the strip ─────────────────────────────────────────────────────── */
    const stripX = 40;
    const stripY = 84;
    const stripW = width - 80;
    const stripH = 58;

    const g = this.add.graphics();
    // The sea above the strip, the desert below: the two things that orient you.
    g.fillStyle(0x1d5a6b, 1).fillRect(stripX, stripY - 16, stripW, 16);
    g.fillStyle(0x6f5334, 1).fillRect(stripX, stripY + stripH, stripW, 14);
    this.layer.add(g);

    DISTRICTS.forEach((district, index) => {
      const x = stripX + (district.x / WORLD_TILES) * stripW;
      const w = (district.width / WORLD_TILES) * stripW;
      const selected = index === this.index;
      const isObjective = this.objectiveDistricts.has(district.id);

      const cell = this.add.graphics();
      cell.fillStyle(district.tint, selected ? 0.95 : 0.5).fillRect(x, stripY, w - 2, stripH);
      cell.lineStyle(selected ? 3 : 1, selected ? ACCENT : EDGE, 1);
      cell.strokeRect(x + 1, stripY + 1, w - 4, stripH - 2);
      this.layer.add(cell);

      // A marker over any district holding the next step.
      if (isObjective) {
        const marker = this.add.graphics();
        marker.fillStyle(ACCENT, 1);
        marker.fillRect(x + w / 2 - 8, stripY - 14, 16, 4);
        marker.fillRect(x + w / 2 - 5, stripY - 10, 10, 4);
        marker.fillRect(x + w / 2 - 2, stripY - 6, 4, 4);
        this.layer.add(marker);
      }

      // The name, not just an index: a numbered strip tells you nothing about
      // where you are choosing to go.
      const short = district.nameEn.split(' ')[0] ?? district.nameEn;
      this.layer.add(
        this.add
          .text(x + w / 2, stripY + stripH / 2 - 7, short, {
            fontFamily: MONO,
            fontSize: '11px',
            color: selected ? '#120e16' : '#efe3d6',
            fontStyle: 'bold',
          })
          .setOrigin(0.5, 0.5)
          .setResolution(2),
      );
      this.layer.add(
        this.add
          .text(x + w / 2, stripY + stripH / 2 + 10, String(index + 1), {
            fontFamily: MONO,
            fontSize: '10px',
            color: selected ? '#3a2c3f' : '#8a7a8f',
          })
          .setOrigin(0.5, 0.5)
          .setResolution(2),
      );
    });

    /* ── the selected district ─────────────────────────────────────────── */
    const district = DISTRICTS[this.index] as District;
    const panelY = stripY + stripH + 34;

    const panel = this.add.graphics();
    panel.fillStyle(INK, 0.96).fillRect(40, panelY, width - 80, height - panelY - 54);
    panel.lineStyle(2, EDGE, 1).strokeRect(41, panelY + 1, width - 82, height - panelY - 56);
    panel.fillStyle(ACCENT, 1).fillRect(40, panelY, 4, height - panelY - 54);
    this.layer.add(panel);

    this.layer.add(
      this.add
        .text(58, panelY + 16, district.nameEn, {
          fontFamily: MONO,
          fontSize: '17px',
          color: '#efe3d6',
          fontStyle: 'bold',
        })
        .setResolution(2),
    );
    this.layer.add(
      this.add
        .text(58, panelY + 40, district.nameAr, {
          fontFamily: MONO,
          fontSize: '13px',
          color: '#c9a876',
        })
        .setResolution(2),
    );
    this.layer.add(
      this.add
        .text(58, panelY + 62, district.blurbEn, {
          fontFamily: MONO,
          fontSize: '11px',
          color: '#b8a8bc',
          wordWrap: { width: width - 130 },
        })
        .setResolution(2),
    );

    // The landmark itself, so the area is recognisable at a glance.
    if (district.landmark) {
      const preview = this.add
        .image(width - 110, panelY + (height - panelY - 54) / 2, district.landmark)
        .setOrigin(0.5, 0.5);
      const maxH = height - panelY - 100;
      if (preview.height > maxH) preview.setScale(maxH / preview.height);
      this.layer.add(preview);
    }

    // What is actually here.
    const officeNames = district.offices
      .map((id) => getOffice(id)?.nameEn)
      .filter((name): name is string => Boolean(name));
    this.layer.add(
      this.add
        .text(
          58,
          panelY + 96,
          officeNames.length > 0 ? `Here: ${officeNames.join(' · ')}` : 'No desk in this area yet.',
          { fontFamily: MONO, fontSize: '11px', color: '#4fb8ae' },
        )
        .setResolution(2),
    );

    if (this.objectiveDistricts.has(district.id)) {
      this.layer.add(
        this.add
          .text(58, panelY + 116, '★ your next step is here', {
            fontFamily: MONO,
            fontSize: '11px',
            color: '#ffd9a0',
          })
          .setResolution(2),
      );
    }

    this.layer.add(
      this.add
        .text(
          width / 2,
          height - 30,
          'Left/Right — choose   ·   Enter / A — travel here   ·   Esc / B — back',
          { fontFamily: MONO, fontSize: '11px', color: '#8a7a8f' },
        )
        .setOrigin(0.5, 0.5)
        .setResolution(2),
    );
  }

  update(): void {
    if (this.latch.pressed('ArrowLeft', 'KeyA')) {
      this.index = (this.index - 1 + DISTRICTS.length) % DISTRICTS.length;
      this.render();
    }
    if (this.latch.pressed('ArrowRight', 'KeyD')) {
      this.index = (this.index + 1) % DISTRICTS.length;
      this.render();
    }

    const confirmed = this.latch.pressed(...CONFIRM_CODES) || virtualInput.consumeConfirm();
    const cancelled = this.latch.pressed('Escape') || virtualInput.consumeCancel();
    this.latch.clear();

    if (confirmed) {
      this.close(DISTRICTS[this.index]?.id);
      return;
    }
    if (cancelled) this.close(undefined);
  }

  private close(travelTo: string | undefined): void {
    const city = this.scene.get('CityScene') as {
      travelTo(id: string): void;
    } & Phaser.Scene;
    this.scene.stop();
    this.scene.resume('CityScene');
    if (travelTo) city.travelTo(travelTo);
  }
}
