/**
 * @author Shakib
 * @since 25/10/26
 */
import { describe, expect, it } from 'vitest';
import { type Box, cropGrid, mergeFaces } from '../src/lib/faces';

describe('cropGrid', () => {
  it('covers a 720p frame with overlapping square tiles', () => {
    const tiles = cropGrid(1280, 720);
    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.length).toBeLessThanOrEqual(10);
    for (const t of tiles) {
      expect(t.width).toBe(t.height);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(1280);
      expect(t.y + t.height).toBeLessThanOrEqual(720);
    }
    // Every pixel column and row is inside some tile.
    for (const x of [0, 400, 640, 1000, 1279]) expect(tiles.some((t) => x >= t.x && x < t.x + t.width)).toBe(true);
    for (const y of [0, 360, 719]) expect(tiles.some((t) => y >= t.y && y < t.y + t.height)).toBe(true);
  });

  it('still works for a small 4:3 frame', () => {
    expect(cropGrid(320, 240).length).toBeGreaterThan(1);
  });
});

describe('mergeFaces', () => {
  const box = (x: number, y: number, w: number, h = w): Box => ({ x, y, width: w, height: h });

  it('counts one face seen by the full frame and two overlapping tiles once', () => {
    expect(mergeFaces([box(500, 200, 200), box(505, 205, 190), box(498, 198, 150, 205)])).toHaveLength(1);
  });

  it('keeps two people standing side by side', () => {
    expect(mergeFaces([box(300, 200, 120), box(460, 210, 120)])).toHaveLength(2);
  });

  it('drops low-confidence hits, which zoomed tiles produce on shoulders and hair', () => {
    // Scores measured on real frames: faces 0.81–0.97, false positives 0.50–0.64.
    expect(mergeFaces([{ ...box(134, 105, 77), score: 0.96 }, { ...box(268, 200, 54), score: 0.63 }])).toHaveLength(1);
  });

  it('folds a partial face that hangs off the whole face', () => {
    // A tile edge cut the face; the partial box spills past the real one.
    expect(mergeFaces([box(500, 200, 200), box(620, 240, 120, 150)])).toHaveLength(1);
  });

  it('treats a partial face at a tile edge inside a whole one as the same face', () => {
    expect(mergeFaces([box(500, 200, 200), box(500, 230, 90, 120)])).toHaveLength(1);
  });
});
