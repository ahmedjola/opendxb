/**
 * Landing in Dubai — game entry point.
 *
 * An independent, unofficial guide. Every office in the district is fictional
 * and every answer shown is read verbatim from `src/content/answers.json`
 * together with its source link and the date it was last checked.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BackdropScene } from './scenes/BackdropScene';
import { CityScene } from './scenes/CityScene';
import { MapScene } from './scenes/MapScene';
import { HudScene } from './scenes/hud';
import { OfficeScene } from './scenes/OfficeScene';
import { initTouchControls } from './ui/touchControls';
import './styles/game.css';

initTouchControls(document.getElementById('touchpad'));

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 640,
  height: 480,
  pixelArt: true,
  backgroundColor: '#0d0c0a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, BackdropScene, CityScene, HudScene, MapScene, OfficeScene],
});

// Dev-only handle so the scenes can be poked from the console (and from the
// smoke test that drives the game in a real browser). Not present in a build.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>)['__game'] = game;
}
