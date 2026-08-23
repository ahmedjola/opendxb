import Phaser from 'phaser';
import { createArt, createPlayerAnimations } from './art';
import { createLandmarks } from './landmarks';

/** Builds every texture from code, then hands off to the city. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createArt(this);
    createLandmarks(this);
    createPlayerAnimations(this);
    this.scene.start('CityScene');
  }
}
