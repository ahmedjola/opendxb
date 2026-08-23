import { describe, expect, it } from 'vitest';
import { MOUNT_ID, TOUCHPAD_ID, bootFailureMarkup, overlayMarkup } from '../src/site/cityOverlay';

/**
 * The overlay's markup is built as a string so it can be asserted on without a
 * DOM. What matters here is not layout — it is that the promises this project
 * makes survive inside the game layer too.
 */
describe('city overlay markup', () => {
  const markup = overlayMarkup();

  it('mounts the canvas where Phaser is told to look for it', () => {
    expect(markup).toContain(`id="${MOUNT_ID}"`);
  });

  it('carries the unofficial-guide notice inside the overlay', () => {
    // The site's notice bar is behind the overlay and therefore invisible while
    // the city is open. The disclaimer has to come with it.
    expect(markup).toMatch(/unofficial guide/i);
    expect(markup).toMatch(/fictional/i);
  });

  it('always offers a way back to the written content', () => {
    expect(markup).toContain('data-city-dismiss');
    expect(markup).toContain('guide.html');
  });

  it('has a labelled close control', () => {
    expect(markup).toContain('id="city-close"');
  });

  it('reproduces the full touch pad initTouchControls binds', () => {
    // initTouchControls queries [data-dir] and [data-action] under this root.
    // A missing direction is a control that silently does nothing on a phone.
    expect(markup).toContain(`id="${TOUCHPAD_ID}"`);
    for (const dir of ['up', 'down', 'left', 'right']) {
      expect(markup).toContain(`data-dir="${dir}"`);
    }
    expect(markup).toContain('data-action="confirm"');
    expect(markup).toContain('data-action="cancel"');
  });

  it('keeps the touch pad out of the tab order', () => {
    // Keyboard users have full parity via arrows/WASD; the pad is a pointer
    // affordance and tabbing through six of them to reach Close is hostile.
    const padButtons = markup.match(/class="tbtn[^"]*"/g) ?? [];
    expect(padButtons.length).toBe(6);
    expect(markup.match(/tabindex="-1"/g)?.length).toBe(6);
  });
});

describe('boot failure', () => {
  it('never leaves the reader stranded in a blank overlay', () => {
    const markup = bootFailureMarkup();
    expect(markup).toContain('data-city-dismiss');
    expect(markup).toContain('guide.html');
  });
});
