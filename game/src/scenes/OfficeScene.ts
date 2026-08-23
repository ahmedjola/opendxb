import Phaser from 'phaser';
import {
  DISCLAIMER,
  getAnswersForOffice,
  getOffice,
  hasRealSource,
} from '../content/loader';
import type { Answer, Office } from '../content/types';
import {
  CANCEL_CODES,
  CONFIRM_CODES,
  DOWN_CODES,
  KeyLatch,
  UP_CODES,
} from '../ui/keyLatch';
import { virtualInput } from '../ui/touchControls';

const MONO = 'ui-monospace, "DejaVu Sans Mono", monospace';
const PANEL_X = 20;
const PANEL_TOP = 116;

type Mode = 'list' | 'answer';

/**
 * Inside an office: a list of questions, then the stored answer.
 *
 * The answer text, its source and its "checked on" date are read straight from
 * the content file and printed as-is. Nothing here writes or rewrites an answer.
 */
export class OfficeScene extends Phaser.Scene {
  private office!: Office;
  private answers: Answer[] = [];
  private mode: Mode = 'list';
  private selected = 0;
  private layer!: Phaser.GameObjects.Container;
  private latch!: KeyLatch;
  private prevHeld = { up: false, down: false };

  constructor() {
    super('OfficeScene');
  }

  init(data: { officeId?: string }): void {
    const office = getOffice(data.officeId ?? '');
    if (!office) {
      this.closeOffice();
      return;
    }
    this.office = office;
    this.answers = getAnswersForOffice(office.id);
    this.mode = 'list';
    this.selected = 0;
    this.prevHeld = { up: false, down: false };
  }

  create(): void {
    if (!this.office) return;
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x14130f, 0.94).setOrigin(0, 0);
    this.drawInterior();

    this.add
      .rectangle(PANEL_X, PANEL_TOP, width - PANEL_X * 2, height - PANEL_TOP - 34, 0x1e1c17, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x4a463c);

    this.add
      .text(width / 2, height - 18, DISCLAIMER, {
        fontFamily: MONO,
        fontSize: '11px',
        color: '#ffe9a8',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);

    this.layer = this.add.container(0, 0);
    this.setupKeys();
    this.render();
  }

  /** A small, entirely invented office interior. No emblem, seal or crest. */
  private drawInterior(): void {
    const { width } = this.scale;
    const g = this.add.graphics();
    g.fillStyle(0x2b2822, 1).fillRect(0, 24, width, 92);
    g.fillStyle(this.office.roof, 1).fillRect(0, 24, width, 8);
    g.fillStyle(0x6b4f36, 1).fillRect(width / 2 - 90, 78, 180, 30); // desk
    g.fillStyle(0x53402c, 1).fillRect(width / 2 - 90, 106, 180, 6);

    this.add.image(width / 2 - 120, 96, 'planter').setOrigin(0.5, 1);
    this.add.image(width / 2 + 120, 96, 'planter').setOrigin(0.5, 1);
    this.add.sprite(width / 2, 82, 'player-a').setOrigin(0.5, 1).setTint(0xbfd8c9); // clerk

    this.add
      .text(width / 2, 44, `${this.office.nameEn}  ·  fictional office`, {
        fontFamily: MONO,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);
    this.add
      .text(width / 2, 62, this.office.blurbEn, {
        fontFamily: MONO,
        fontSize: '11px',
        color: '#b3ac9e',
      })
      .setOrigin(0.5, 0.5)
      .setResolution(2);
  }

  private setupKeys(): void {
    this.latch = new KeyLatch(this);
  }

  private text(
    x: number,
    y: number,
    value: string,
    size: number,
    colour: string,
    wrapWidth?: number,
  ): Phaser.GameObjects.Text {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: MONO,
      fontSize: `${size}px`,
      color: colour,
    };
    if (wrapWidth) style.wordWrap = { width: wrapWidth, useAdvancedWrap: true };
    const node = this.add.text(x, y, value, style).setResolution(2);
    this.layer.add(node);
    return node;
  }

  private render(): void {
    this.layer.removeAll(true);
    if (this.mode === 'list') this.renderList();
    else this.renderAnswer();
  }

  private renderList(): void {
    const { width } = this.scale;
    const wrap = width - PANEL_X * 2 - 60;
    let y = PANEL_TOP + 14;

    this.text(PANEL_X + 16, y, 'Questions people ask here', 13, '#ffffff');
    y += 26;

    if (this.answers.length === 0) {
      this.text(
        PANEL_X + 16,
        y,
        'No questions have been written for this office yet. Sourced content is still being added.',
        12,
        '#b3ac9e',
        wrap,
      );
      this.renderFooterHints();
      return;
    }

    this.answers.forEach((answer, index) => {
      const isSelected = index === this.selected;

      const label = this.text(
        PANEL_X + 22,
        y,
        `${isSelected ? '>' : ' '} ${answer.questionEn}`,
        12,
        isSelected ? '#ffffff' : '#cfc8ba',
        wrap,
      );

      let blockHeight = label.height + 6;
      if (!hasRealSource(answer)) {
        const flag = this.text(
          PANEL_X + 34,
          y + label.height + 2,
          'PLACEHOLDER — NOT VERIFIED',
          10,
          '#ffe9a8',
        );
        blockHeight += flag.height + 4;
      }

      // Highlight strip is created after measuring the block, then pushed behind it.
      const rowWidth = width - PANEL_X * 2 - 16;
      const row = this.add
        .rectangle(PANEL_X + 8, y - 4, rowWidth, blockHeight, isSelected ? 0x3a3529 : 0x1e1c17)
        .setOrigin(0, 0);
      this.layer.add(row);
      this.layer.sendToBack(row);

      row.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, rowWidth, blockHeight),
        Phaser.Geom.Rectangle.Contains,
      );
      row.on('pointerdown', () => {
        this.selected = index;
        this.mode = 'answer';
        this.render();
      });

      y += blockHeight + 10;
    });

    this.renderFooterHints();
  }

  private renderAnswer(): void {
    const { width, height } = this.scale;
    const answer = this.answers[this.selected];
    if (!answer) {
      this.mode = 'list';
      this.render();
      return;
    }
    const wrap = width - PANEL_X * 2 - 40;
    let y = PANEL_TOP + 12;

    y += this.text(PANEL_X + 16, y, answer.questionEn, 13, '#ffffff', wrap).height + 8;

    if (!hasRealSource(answer)) {
      const flag = this.add
        .rectangle(PANEL_X + 16, y, 210, 18, 0x4a3a00)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0xc9a227);
      this.layer.add(flag);
      this.text(PANEL_X + 22, y + 3, 'PLACEHOLDER — NOT VERIFIED', 10, '#ffe9a8');
      y += 26;
    }

    y += this.text(PANEL_X + 16, y, answer.answerEn, 12, '#e6e0d4', wrap).height + 12;

    const sourceLine = hasRealSource(answer)
      ? `Source: ${answer.sourceEntity}\n${answer.sourceUrl}`
      : `Source: ${answer.sourceUrl} — no source link attached yet (${answer.sourceEntity})`;
    y += this.text(PANEL_X + 16, y, sourceLine, 11, '#8fd0e8', wrap).height + 4;
    this.text(PANEL_X + 16, y, `Checked on: ${answer.checkedOn}`, 11, '#b3ac9e', wrap);

    this.text(
      PANEL_X + 16,
      height - 54,
      'Esc / B — back to the questions   ·   G — plain text version (with Arabic)',
      10,
      '#8d8677',
    );
  }

  private renderFooterHints(): void {
    const { height } = this.scale;
    this.text(
      PANEL_X + 16,
      height - 54,
      'Up/Down — choose   ·   Enter / A — read   ·   Esc / B — leave   ·   G — plain text version',
      10,
      '#8d8677',
    );
  }

  update(): void {
    if (!this.office || !this.latch) return;

    const heldUp = virtualInput.isHeld('up');
    const heldDown = virtualInput.isHeld('down');
    const touchUp = heldUp && !this.prevHeld.up;
    const touchDown = heldDown && !this.prevHeld.down;
    this.prevHeld = { up: heldUp, down: heldDown };

    const openGuide = this.latch.pressed('KeyG');
    const up = this.latch.pressed(...UP_CODES) || touchUp;
    const down = this.latch.pressed(...DOWN_CODES) || touchDown;
    const confirm = this.latch.pressed(...CONFIRM_CODES) || virtualInput.consumeConfirm();
    const cancel = this.latch.pressed(...CANCEL_CODES) || virtualInput.consumeCancel();
    this.latch.clear();

    if (openGuide) window.open('./guide.html', '_blank', 'noopener');

    if (this.mode === 'list') {
      if (this.answers.length > 0 && up) {
        this.selected = (this.selected - 1 + this.answers.length) % this.answers.length;
        this.render();
      }
      if (this.answers.length > 0 && down) {
        this.selected = (this.selected + 1) % this.answers.length;
        this.render();
      }
      if (confirm && this.answers.length > 0) {
        this.mode = 'answer';
        this.render();
      }
      if (cancel) this.closeOffice();
      return;
    }

    if (cancel) {
      this.mode = 'list';
      this.render();
    }
  }

  private closeOffice(): void {
    virtualInput.releaseAll();
    this.scene.stop();
    this.scene.resume('DistrictScene');
  }
}
