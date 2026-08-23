import Phaser from 'phaser';

/**
 * Latches discrete key presses so a very fast tap is never dropped.
 *
 * Polling `Phaser.Input.Keyboard.JustDown` in `update()` misses a press whose
 * keyup lands in the same frame as its keydown — which is exactly what happens
 * with a quick tap, a key-repeat blip, or an automated test. Recording keydowns
 * as they arrive and consuming them once per frame fixes that.
 */
export class KeyLatch {
  private codes = new Set<string>();

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return;
    // Stop the page from scrolling under the game.
    keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE']);
    keyboard.on('keydown', (event: KeyboardEvent) => this.codes.add(event.code));
    scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.codes.clear());
  }

  /** True if any of these `KeyboardEvent.code` values was pressed this frame. */
  pressed(...codes: string[]): boolean {
    return codes.some((code) => this.codes.has(code));
  }

  clear(): void {
    this.codes.clear();
  }
}

export const CONFIRM_CODES = ['KeyE', 'Enter', 'NumpadEnter', 'Space'];
export const CANCEL_CODES = ['Escape', 'Backspace', 'KeyQ'];
export const UP_CODES = ['ArrowUp', 'KeyW'];
export const DOWN_CODES = ['ArrowDown', 'KeyS'];
