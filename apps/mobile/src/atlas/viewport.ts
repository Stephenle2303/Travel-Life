export type Viewport = { scale: number; x: number; y: number };
export type MapSize = { width: number; height: number };
export const WORLD_SIZE = { width: 2048, height: 1280 };
export const WORLD_VIEW: Viewport = { scale: 1, x: 0, y: 0 };
/** Country/region exploration relative to the full-world fit. */
export const MAX_WORLD_SCALE = 64;
export function fittedSize(size: MapSize) {
  const fit = Math.max(0, Math.min((size.width - 16) / WORLD_SIZE.width, (size.height - 16) / WORLD_SIZE.height));
  return { width: WORLD_SIZE.width * fit, height: WORLD_SIZE.height * fit };
}
export function boundViewport(view: Viewport, size: MapSize): Viewport {
  const scale = Math.max(1, Math.min(MAX_WORLD_SCALE, view.scale));
  const fitted = fittedSize(size);
  const limitX = Math.max(0, (fitted.width * scale - size.width) / 2 + 8);
  const limitY = Math.max(0, (fitted.height * scale - size.height) / 2 + 8);
  return { scale, x: limitX ? Math.max(-limitX, Math.min(limitX, view.x)) : 0, y: limitY ? Math.max(-limitY, Math.min(limitY, view.y)) : 0 };
}
export function zoomViewport(view: Viewport, scale: number, focal: { x: number; y: number }, size: MapSize): Viewport {
  const nextScale = Math.max(1, Math.min(MAX_WORLD_SCALE, scale));
  const ratio = nextScale / view.scale;
  return boundViewport({ scale: nextScale, x: focal.x - (focal.x - view.x) * ratio, y: focal.y - (focal.y - view.y) * ratio }, size);
}
