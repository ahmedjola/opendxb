/**
 * The heads-up display.
 *
 * Not decoration: it reads the same `localStorage` progress the site writes, so
 * walking into the city shows you *your* next step, not a generic one. Tick a
 * step off on the page, come back in, and the objective has moved on.
 *
 * Drawn inside the canvas rather than as DOM so it scales with the game and
 * works identically on the standalone page and inside the site overlay.
 */
import Phaser from 'phaser';
import { readObjective, type Objective } from '../site/objective';
import { browserStorage } from '../site/progress';
import { getLang, readLang, setLang, t } from '../site/i18n';
import type { District } from '../world/districts';

const MONO = 'ui-monospace, "DejaVu Sans Mono", monospace';

/** Panel colours, matched to the site's palette so the two read as one thing. */
const INK = 0x1b1420;
const EDGE = 0x3a2c3f;
const HILITE = 0x5a4560;
const ACCENT = 0xf2a25c;

/** A framed panel: dark fill, light top edge, dark bottom edge, hard corners. */
function panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x000000, 0.35).fillRect(x + 3, y + 3, w, h); // drop shadow
  g.fillStyle(INK, 0.94).fillRect(x, y, w, h);
  g.lineStyle(2, EDGE, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle(HILITE, 0.5).fillRect(x + 2, y + 2, w - 4, 1);
}

/**
 * The HUD, as its own scene running on top of the district.
 *
 * It has to be a separate scene rather than pinned objects inside the district:
 * the district's camera is zoomed in, and a camera zoom scales everything it
 * draws — including `setScrollFactor(0)` objects. Panels sized for a 640x480
 * viewport ended up drawn at 2x and mostly off the edge. A second scene gets
 * its own camera at 1:1.
 */
export class HudScene extends Phaser.Scene {
  private objective: Objective = { step: null, done: 0, total: 0, label: '' };
  private barFill!: Phaser.GameObjects.Rectangle;
  private countText!: Phaser.GameObjects.Text;
  private taskTitle!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private promptBox!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
    // The game reads the language the site is set to, so walking into the city
    // does not silently switch you back to English.
    setLang(readLang(browserStorage()));
    this.objective = readObjective();
    this.build();
    this.buildPrompt();
  }

  private build(): void {
    const { width } = this.scale;
    const g = this.add.graphics().setDepth(100);

    /* ── the player panel, top left ──────────────────────────────────────── */
    panel(g, 8, 8, 202, 66);

    // Portrait: the player's own sprite, boxed and scaled up.
    g.fillStyle(0x24221e, 1).fillRect(14, 14, 42, 42);
    g.lineStyle(2, HILITE, 1).strokeRect(14, 14, 42, 42);
    this.add
      .image(35, 40, 'player-down-0')
      .setOrigin(0.5, 0.5)
      .setScale(2)
      .setDepth(101)
      .setCrop(0, 0, 16, 12); // head and shoulders only

    this.add
      .text(64, 16, t('hud.player'), {
        fontFamily: MONO,
        fontSize: '11px',
        color: '#ffd9a0',
        fontStyle: 'bold',
      })
      .setResolution(2)
      .setDepth(101);

    this.add
      .text(64, 30, this.objective.label.toUpperCase(), {
        fontFamily: MONO,
        fontSize: '9px',
        color: '#8a7a8f',
      })
      .setResolution(2)
      .setDepth(101);

    // The progress bar, which is the residency path, not a health bar.
    g.fillStyle(0x24221e, 1).fillRect(64, 48, 138, 12);
    g.lineStyle(1, HILITE, 1).strokeRect(64, 48, 138, 12);
    this.barFill = this.add
      .rectangle(66, 50, 0, 8, ACCENT)
      .setOrigin(0, 0)
      .setDepth(101);

    // Inside the bar, right-aligned: on its own line it collided with the
    // path label whenever the label ran long.
    this.countText = this.add
      .text(198, 50, '', { fontFamily: MONO, fontSize: '9px', color: '#c4b4c8' })
      .setOrigin(1, 0)
      .setResolution(2)
      .setDepth(101);

    /* ── the objective card, under it ────────────────────────────────────── */
    panel(g, 8, 82, 202, 58);
    g.fillStyle(ACCENT, 1).fillRect(8, 82, 4, 58); // accent spine

    this.add
      .text(18, 88, t('hud.nextStep'), { fontFamily: MONO, fontSize: '9px', color: '#f2a25c' })
      .setResolution(2)
      .setDepth(101);

    this.taskTitle = this.add
      .text(18, 102, '', {
        fontFamily: MONO,
        fontSize: '11px',
        color: '#efe3d6',
        wordWrap: { width: 184 },
      })
      .setResolution(2)
      .setDepth(101);

    /* ── the standing disclaimer, top right ──────────────────────────────── */
    // Never removed, never collapsed. It is the deal this project makes.
    panel(g, width - 214, 8, 206, 34);
    this.add
      .text(width - 204, 14, t('hud.unofficial'), {
        fontFamily: MONO,
        fontSize: '10px',
        color: '#ffe9a8',
        fontStyle: 'bold',
      })
      .setResolution(2)
      .setDepth(101);
    this.add
      .text(width - 204, 27, t('hud.fictional'), {
        fontFamily: MONO,
        fontSize: '9px',
        color: '#8a7a8f',
      })
      .setResolution(2)
      .setDepth(101);

    this.refresh();
  }

  /** Re-read progress and repaint. Called on entry and on coming back out. */
  refresh(): void {
    this.objective = readObjective();
    const { done, total, step } = this.objective;

    const ratio = total > 0 ? done / total : 0;
    this.barFill.width = Math.round(134 * ratio);
    this.countText.setText(total > 0 ? `${done}/${total}` : '—');

    if (step) {
      this.taskTitle.setText(getLang() === 'ar' ? step.titleAr : step.titleEn);
    } else {
      this.taskTitle.setText(t(total > 0 ? 'hud.allDone' : 'hud.pickPath'));
    }
  }

  /**
   * The door prompt, drawn as a speech bubble — you are about to talk to
   * someone, and it should look like it rather than like a caption bar.
   */
  private buildPrompt(): void {
    const { width, height } = this.scale;
    this.promptBox = this.add.graphics().setDepth(100).setVisible(false);
    this.prompt = this.add
      .text(width / 2, height - 40, '', {
        fontFamily: MONO,
        fontSize: '12px',
        color: '#efe3d6',
        align: 'center',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2)
      .setDepth(101)
      .setVisible(false);
  }

  /** Draw the bubble to fit whatever is in it, with a stepped tail underneath. */
  showPrompt(text: string): void {
    this.prompt.setText(text).setVisible(true);
    const w = this.prompt.width + 26;
    const h = this.prompt.height + 18;
    const x = this.prompt.x - w / 2;
    const y = this.prompt.y - h / 2;

    this.promptBox.clear().setVisible(true);
    this.promptBox.fillStyle(0x000000, 0.35).fillRect(x + 3, y + 3, w, h);
    this.promptBox.fillStyle(INK, 0.96).fillRect(x, y, w, h);
    this.promptBox.lineStyle(2, ACCENT, 1).strokeRect(x + 1, y + 1, w - 2, h - 2);
    // Tail on top, pointing back up at the door being described. Stepped rows
    // rather than a triangle, so it stays pixel-crisp.
    this.promptBox.fillStyle(INK, 0.96);
    this.promptBox.fillRect(this.prompt.x - 2, y - 9, 4, 3);
    this.promptBox.fillRect(this.prompt.x - 5, y - 6, 10, 3);
    this.promptBox.fillRect(this.prompt.x - 8, y - 3, 16, 3);
  }

  hidePrompt(): void {
    this.prompt?.setVisible(false);
    this.promptBox?.clear().setVisible(false);
  }

  /**
   * Name the area the player has just walked into.
   *
   * A banner rather than a permanent label: on a city-length strip you need to
   * know you have crossed a boundary, but a name pinned to the screen forever
   * is just clutter once you have read it.
   */
  announceDistrict(district: District): void {
    const { width } = this.scale;
    const box = this.add.graphics().setDepth(110);
    const name = this.add
      .text(width / 2, 190, getLang() === 'ar' ? district.nameAr : district.nameEn, {
        fontFamily: MONO,
        fontSize: '18px',
        color: '#efe3d6',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2)
      .setDepth(111);
    const arabic = this.add
      .text(width / 2, 214, getLang() === 'ar' ? district.nameEn : district.nameAr, {
        fontFamily: MONO,
        fontSize: '13px',
        color: '#c9a876',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2)
      .setDepth(111);

    const w = Math.max(name.width, arabic.width) + 48;
    box.fillStyle(INK, 0.9).fillRect(width / 2 - w / 2, 172, w, 58);
    box.fillStyle(ACCENT, 1).fillRect(width / 2 - w / 2, 172, w, 3);
    box.fillStyle(ACCENT, 1).fillRect(width / 2 - w / 2, 227, w, 3);

    const parts = [box, name, arabic];
    this.tweens.add({
      targets: parts,
      alpha: 0,
      delay: 1600,
      duration: 600,
      onComplete: () => parts.forEach((part) => part.destroy()),
    });
  }

  /** Answer ids on the current step, so the district can flag the right door. */
  currentAnswerIds(): readonly string[] {
    return this.objective.step?.answerIds ?? [];
  }
}
