/**
 * The walkable city, on the same page as everything else.
 *
 * The game used to live at `/game.html`, which made it a footnote: you had to
 * already know it existed and go and find it. It belongs in the flow — you
 * land, you say who you are, and then you can go and walk the place. So it
 * opens as a full-screen layer over the site instead of a page you leave for.
 *
 * Phaser is imported lazily on first open. It is by far the largest thing this
 * site ships, and someone who only wants to read their visa steps should never
 * pay to download a game engine.
 */

/** The element Phaser mounts its canvas into. */
export const MOUNT_ID = 'city-mount';

/** The touch pad's root. Ids match `game.html` so `initTouchControls` binds it. */
export const TOUCHPAD_ID = 'city-touchpad';

/**
 * The overlay's markup, as a string, so it can be asserted on without a DOM.
 *
 * The d-pad is reproduced here rather than shared with `game.html` because the
 * two pages boot independently; `initTouchControls` binds whatever `[data-dir]`
 * and `[data-action]` buttons it finds under the root it is handed.
 */
export function overlayMarkup(): string {
  return `
    <div class="city-bar">
      <span class="mono city-bar-title">Walk the city</span>
      <span class="city-bar-hint">
        Arrows or WASD to walk &middot; <kbd>E</kbd> at a door &middot; <kbd>Esc</kbd> to step back
        &middot; <kbd>Tab</kbd> then <kbd>Enter</kbd> to leave
      </span>
      <button type="button" class="btn city-close" id="city-close" data-variant="primary">
        Close
      </button>
    </div>

    <div class="city-stage">
      <div id="${MOUNT_ID}" role="application" aria-label="Dubai district — top-down game"></div>
    </div>

    <p class="city-note">
      <strong>Unofficial guide — every office in here is fictional.</strong>
      Each answer still carries the official source it came from.
      Prefer to read? <a href="#journey" data-city-dismiss>Your path</a> and the
      <a href="./guide.html">plain guide</a> hold exactly the same content.
    </p>

    <div class="touchpad" id="${TOUCHPAD_ID}" data-visible="false">
      <div class="dpad">
        <button type="button" class="tbtn up" data-dir="up" tabindex="-1" aria-label="Walk up">▲</button>
        <button type="button" class="tbtn left" data-dir="left" tabindex="-1" aria-label="Walk left">◀</button>
        <button type="button" class="tbtn right" data-dir="right" tabindex="-1" aria-label="Walk right">▶</button>
        <button type="button" class="tbtn down" data-dir="down" tabindex="-1" aria-label="Walk down">▼</button>
      </div>
      <div class="actions">
        <button type="button" class="tbtn act" data-action="confirm" tabindex="-1" aria-label="Enter or confirm">A</button>
        <button type="button" class="tbtn act" data-action="cancel" tabindex="-1" aria-label="Back or cancel">B</button>
      </div>
    </div>
  `;
}

/**
 * What to show if the engine never loads.
 *
 * A blank black rectangle with no way out is the worst possible failure here,
 * and it is the one that happens by default. Everything the city contains is
 * also plain text on this page, so say so and point at it.
 */
export function bootFailureMarkup(): string {
  return `
    <p class="city-error">
      The city could not start in this browser. Nothing is lost — every answer it
      contains is also written out on <a href="#journey" data-city-dismiss>your path</a>
      and in the <a href="./guide.html">plain guide</a>.
    </p>
  `;
}

/** Resolved once and reused. Booting Phaser twice would leak a second canvas. */
let gamePromise: Promise<unknown> | null = null;

/** Import and boot Phaser. Deliberately not at module scope — see the header. */
async function bootCity(): Promise<unknown> {
  const [
    { default: Phaser },
    { BootScene },
    { BackdropScene },
    { CityScene },
    { HudScene },
    { MapScene },
    { OfficeScene },
    { initTouchControls },
  ] = await Promise.all([
    import('phaser'),
    import('../scenes/BootScene'),
    import('../scenes/BackdropScene'),
    import('../scenes/CityScene'),
    import('../scenes/hud'),
    import('../scenes/MapScene'),
    import('../scenes/OfficeScene'),
    import('../ui/touchControls'),
  ]);

  initTouchControls(document.getElementById(TOUCHPAD_ID));

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: MOUNT_ID,
    width: 640,
    height: 480,
    pixelArt: true,
    backgroundColor: '#0d0c0a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scene: [BootScene, BackdropScene, CityScene, HudScene, MapScene, OfficeScene],
  });
}

/**
 * Mount the overlay and wire every `[data-open-city]` control on the page to it.
 *
 * Safe to call on a page that has no such control: it costs one hidden element
 * and two listeners, and loads nothing until something asks it to.
 */
export function initCityOverlay(): void {
  const overlay = document.createElement('div');
  overlay.className = 'city-overlay';
  overlay.id = 'city-overlay';
  // A modal dialog, so assistive tech treats the page behind it as inert.
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Walk the city');
  overlay.hidden = true;
  // Focusable, so opening can put focus HERE rather than on the close button.
  // With focus on Close, pressing Enter — the game's own confirm key — fired
  // the button and shut the whole city instead of opening a door.
  overlay.tabIndex = -1;
  overlay.innerHTML = overlayMarkup();
  document.body.append(overlay);

  const closeButton = overlay.querySelector<HTMLButtonElement>('#city-close');
  /** Where focus was before opening, so closing returns the user where they were. */
  let opener: HTMLElement | null = null;

  function close(): void {
    if (overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('city-open');
    // The game keeps running behind the overlay on purpose: re-booting Phaser on
    // every open is slow, and it would forget where the player was standing.
    opener?.focus();
  }

  function open(trigger: HTMLElement | null): void {
    opener = trigger;
    overlay.hidden = false;
    document.body.classList.add('city-open');
    overlay.focus();

    gamePromise ??= bootCity().catch((error: unknown) => {
      const mount = document.getElementById(MOUNT_ID);
      if (mount) mount.innerHTML = bootFailureMarkup();
      // Cleared so a later open can try again — a transient failure should not
      // permanently brick the city.
      gamePromise = null;
      console.error('The city failed to boot:', error);
      return null;
    });
  }

  closeButton?.addEventListener('click', close);

  overlay.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-city-dismiss]')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || overlay.hidden) return;
    // Escape belongs to the game: inside an office it means "step back out".
    // It closes the overlay only from the Close button, which is the first stop
    // in the overlay's tab order and is named in the bar.
    if (document.activeElement === closeButton) close();
  });

  // Any control anywhere on the page can open it.
  document.addEventListener('click', (event) => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-open-city]');
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
  });
}
