/**
 * @author Shakib
 * @since 25/10/26
 *
 * BlazeFace short-range shrinks the whole frame to 128x128, so faces narrower
 * than ~13% of the frame vanish: a person behind you, or you sitting back.
 * Scanning overlapping zoomed-in square tiles as well as the full frame fixes
 * that; overlapping hits are merged so each face counts once.
 */
import type { FaceDetector } from '@mediapipe/tasks-vision';

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  score?: number;
  /** True when the box came from a zoomed tile rather than the full frame. */
  tile?: boolean;
}

/** Tile side as a share of the frame's shorter edge. */
const TILE = 0.6;
/** Neighbouring tiles overlap by this share, so a face on a seam is whole in one of them. */
const OVERLAP = 0.3;

function steps(length: number, side: number): number[] {
  if (side >= length) return [0];
  const count = Math.ceil((length - side) / (side * (1 - OVERLAP))) + 1;
  const stride = (length - side) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * stride));
}

export function cropGrid(width: number, height: number): Box[] {
  const side = Math.round(Math.min(width, height) * TILE);
  return steps(height, side).flatMap((y) => steps(width, side).map((x) => ({ x, y, width: side, height: side })));
}

function overlapOfSmaller(a: Box, b: Box): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.min(a.width * a.height, b.width * b.height);
}

/**
 * Zoomed tiles make the model see faces in shoulders and hair. Measured on real
 * frames: faces score 0.81–0.97, those false hits 0.50–0.64.
 */
export const MIN_SCORE = 0.75;

/** Drops weak hits and collapses detections of the same face (full frame and several tiles). */
export function mergeFaces(boxes: Box[]): Box[] {
  const kept: Box[] = [];
  const confident = boxes.filter((b) => b.score === undefined || b.score >= MIN_SCORE);
  // Largest first, so a partial face cut by a tile edge folds into the whole one.
  for (const box of confident.sort((a, b) => b.width * b.height - a.width * a.height)) {
    if (!kept.some((k) => overlapOfSmaller(k, box) > 0.5)) kept.push(box);
  }
  return kept;
}

/** Counts faces in the current video frame. The detector must be in IMAGE mode. */
export function countFaces(detector: FaceDetector, video: HTMLVideoElement, canvas: HTMLCanvasElement): number {
  const { videoWidth: w, videoHeight: h } = video;
  if (!w || !h) return 0;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, w, h);

  const found: Box[] = [];
  const collect = (source: HTMLCanvasElement, dx: number, dy: number, tile: boolean) => {
    for (const d of detector.detect(source).detections) {
      const b = d.boundingBox;
      const score = d.categories[0]?.score ?? 0;
      if (b) found.push({ x: b.originX + dx, y: b.originY + dy, width: b.width, height: b.height, score, tile });
    }
  };

  collect(canvas, 0, 0, false);
  const tile = document.createElement('canvas');
  const tileCtx = tile.getContext('2d', { willReadFrequently: true })!;
  for (const t of cropGrid(w, h)) {
    tile.width = t.width;
    tile.height = t.height;
    tileCtx.drawImage(canvas, t.x, t.y, t.width, t.height, 0, 0, t.width, t.height);
    collect(tile, t.x, t.y, true);
  }
  return mergeFaces(found).length;
}
