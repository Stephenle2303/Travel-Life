import { fittedSize, type MapSize, type Viewport } from '@/atlas/viewport';

export const TILE_SIZE = 512;
export const TILE_LEVELS = [4096, 8192, 16384];
export const MAX_VISIBLE_TILES = 48;
export type VisibleTile = { key: string; level: number; col: number; row: number; left: number; top: number; size: number };

/** Only return tiles intersecting the viewport; density selects source resolution. */
export function visibleAtlasTiles(size: MapSize, view: Viewport, density: number): VisibleTile[] {
  const fit = fittedSize(size);
  const width = fit.width * view.scale;
  const height = fit.height * view.scale;
  if (width <= 0 || height <= 0 || width * density <= 2048) return [];
  let level = TILE_LEVELS.find((candidate) => candidate >= width * density) ?? TILE_LEVELS[TILE_LEVELS.length - 1];
  const left = (size.width - width) / 2 + view.x;
  const top = (size.height - height) / 2 + view.y;
  // A very dense display must not turn the visible set into an unbounded decode.
  while (level > 2048) {
    const tileSize = TILE_SIZE / level * width;
    const columns = Math.min(level / TILE_SIZE - 1, Math.floor((size.width-left)/tileSize)) - Math.max(0, Math.floor(-left/tileSize)) + 1;
    const rows = Math.min(level*5/8/TILE_SIZE - 1, Math.floor((size.height-top)/tileSize)) - Math.max(0, Math.floor(-top/tileSize)) + 1;
    if (Math.max(0,columns)*Math.max(0,rows) <= MAX_VISIBLE_TILES) break;
    level /= 2;
  }
  if (level <= 2048) return [];
  const tileSize = TILE_SIZE / level * width;
  const cols = level / TILE_SIZE;
  const rows = level * 5 / 8 / TILE_SIZE;
  const firstCol = Math.max(0, Math.floor(-left / tileSize));
  const lastCol = Math.min(cols - 1, Math.floor((size.width - left) / tileSize));
  const firstRow = Math.max(0, Math.floor(-top / tileSize));
  const lastRow = Math.min(rows - 1, Math.floor((size.height - top) / tileSize));
  const tiles: VisibleTile[] = [];
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      tiles.push({ key: `${level}:${col}:${row}`, level, col, row, left: left + col * tileSize, top: top + row * tileSize, size: tileSize });
    }
  }
  return tiles;
}
