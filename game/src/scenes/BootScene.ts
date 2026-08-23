import Phaser from 'phaser';
import { createArt, createPlayerAnimations } from './art';

/** Builds every texture from code, then hands off to the district. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    createArt(this);
    createPlayerAnimations(this);
    this.scene.start('DistrictScene');
  }
}
