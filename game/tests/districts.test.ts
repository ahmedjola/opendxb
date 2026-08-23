import { describe, expect, it } from 'vitest';
import { OFFICES } from '../src/content/offices';
import {
  DISTRICTS,
  WORLD_TILES,
  arrivalTile,
  districtAt,
  districtForOffice,
  getDistrict,
} from '../src/world/districts';

/**
 * The map's geometry is the one thing every other system trusts: fast travel
 * lands on it, the minimap draws from it, and the journey uses it to say where
 * to go. A gap or an overlap here is a player dropped into nowhere.
 */
describe('district strip', () => {
  it('tiles the world with no gaps and no overlaps', () => {
    const ordered = [...DISTRICTS].sort((a, b) => a.x - b.x);
    expect(ordered[0]?.x).toBe(0);
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1] as (typeof ordered)[number];
      expect(ordered[i]?.x, `gap or overlap before ${ordered[i]?.id}`).toBe(
        previous.x + previous.width,
      );
    }
  });

  it('derives the world width from the last district', () => {
    const last = [...DISTRICTS].sort((a, b) => a.x - b.x).at(-1);
    expect(WORLD_TILES).toBe((last?.x ?? 0) + (last?.width ?? 0));
  });

  it('resolves every tile in the world to a district', () => {
    for (let x = 0; x < WORLD_TILES; x += 1) {
      expect(districtAt(x), `tile ${x}`).not.toBeNull();
    }
  });

  it('returns null outside the strip rather than clamping', () => {
    // Clamping would silently teleport an out-of-bounds player to Deira.
    expect(districtAt(-1)).toBeNull();
    expect(districtAt(WORLD_TILES)).toBeNull();
  });

  it('drops fast travel inside the district it names', () => {
    for (const district of DISTRICTS) {
      const tile = arrivalTile(district);
      expect(districtAt(tile)?.id, district.id).toBe(district.id);
    }
  });

  it('has unique ids', () => {
    expect(new Set(DISTRICTS.map((d) => d.id)).size).toBe(DISTRICTS.length);
  });
});

describe('offices on the map', () => {
  it('sites every office in exactly one district', () => {
    for (const office of OFFICES) {
      const district = districtForOffice(office.id);
      expect(district, `${office.id} is not on the map`).not.toBeNull();
      const homes = DISTRICTS.filter((d) => d.offices.includes(office.id));
      expect(homes, `${office.id} is in ${homes.length} districts`).toHaveLength(1);
    }
  });

  it('never lists an office that does not exist', () => {
    const known = new Set(OFFICES.map((office) => office.id));
    for (const district of DISTRICTS) {
      for (const id of district.offices) {
        expect(known.has(id), `${district.id} lists unknown office "${id}"`).toBe(true);
      }
    }
  });
});

describe('lookup', () => {
  it('finds a district by id and misses cleanly', () => {
    expect(getDistrict('downtown')?.nameEn).toBe('Downtown');
    expect(getDistrict('atlantis')).toBeUndefined();
  });
});
