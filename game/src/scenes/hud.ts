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
  private taskAr!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private promptBox!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'HudScene' });
  }

  create(): void {
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
      .text(64, 16, 'NEW ARRIVAL', {
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
      .text(18, 88, 'NEXT STEP', { fontFamily: MONO, fontSize: '9px', color: '#f2a25c' })
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

    this.taskAr = this.add
      .text(18, 124, '', { fontFamily: MONO, fontSize: '10px', color: '#8a7a8f' })
      .setResolution(2)
      .setDepth(101);

    /* ── the standing disclaimer, top right ──────────────────────────────── */
    // Never removed, never collapsed. It is the deal this project makes.
    panel(g, width - 214, 8, 206, 34);
    this.add
      .text(width - 204, 14, 'UNOFFICIAL GUIDE', {
        fontFamily: MONO,
        fontSize: '10px',
        color: '#ffe9a8',
        fontStyle: 'bold',
      })
      .setResolution(2)
      .setDepth(101);
    this.add
      .text(width - 204, 27, 'every office here is fictional', {
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
      this.taskTitle.setText(step.titleEn);
      this.taskAr.setText(step.titleAr);
    } else if (total > 0) {
      this.taskTitle.setText('All done — that is the whole path.');
      this.taskAr.setText('');
    } else {
      this.taskTitle.setText('Pick who you are on the page first.');
      this.taskAr.setText('');
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

  /** Answer ids on the current step, so the district can flag the right door. */
  currentAnswerIds(): readonly string[] {
    return this.objective.step?.answerIds ?? [];
  }
}
