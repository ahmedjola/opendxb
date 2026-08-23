/**
 * On-screen touch controls.
 *
 * These are DOM buttons layered under/over the canvas rather than sprites, so
 * they get real hit targets and real labels for free. Keyboard users already
 * have full parity (arrows/WASD + Enter/Esc), so the pad is taken out of the
 * tab order and exists purely as a pointer affordance.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

const held: Record<Direction, boolean> = { up: false, down: false, left: false, right: false };
let confirmQueued = false;
let cancelQueued = false;

export const virtualInput = {
  isHeld(dir: Direction): boolean {
    return held[dir];
  },
  /** Reads and clears a queued "confirm" tap. */
  consumeConfirm(): boolean {
    const value = confirmQueued;
    confirmQueued = false;
    return value;
  },
  /** Reads and clears a queued "cancel" tap. */
  consumeCancel(): boolean {
    const value = cancelQueued;
    cancelQueued = false;
    return value;
  },
  releaseAll(): void {
    held.up = held.down = held.left = held.right = false;
  },
};

function bindDirection(button: HTMLElement, dir: Direction): void {
  const press = (event: PointerEvent) => {
    event.preventDefault();
    held[dir] = true;
    button.dataset['pressed'] = 'true';
    button.setPointerCapture?.(event.pointerId);
  };
  const release = () => {
    held[dir] = false;
    button.dataset['pressed'] = 'false';
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

function bindAction(button: HTMLElement, action: 'confirm' | 'cancel'): void {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.dataset['pressed'] = 'true';
    if (action === 'confirm') confirmQueued = true;
    else cancelQueued = true;
  });
  const release = () => {
    button.dataset['pressed'] = 'false';
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

/** Wire up the pad and reveal it on touch-capable devices. */
export function initTouchControls(root: HTMLElement | null): void {
  if (!root) return;

  for (const button of Array.from(root.querySelectorAll<HTMLElement>('[data-dir]'))) {
    bindDirection(button, button.dataset['dir'] as Direction);
  }
  for (const button of Array.from(root.querySelectorAll<HTMLElement>('[data-action]'))) {
    bindAction(button, button.dataset['action'] as 'confirm' | 'cancel');
  }

  const coarse =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const show = () => {
    root.dataset['visible'] = 'true';
  };
  if (coarse || 'ontouchstart' in window) show();
  // Also reveal the pad the first time anyone actually touches the screen.
  window.addEventListener('touchstart', show, { once: true, passive: true });

  // Never leave a direction stuck down if the tab loses focus mid-press.
  window.addEventListener('blur', () => virtualInput.releaseAll());
}
