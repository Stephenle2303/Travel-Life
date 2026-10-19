/** Offline world fit shared by the browser and native Atlas adapters. */
export const CARTOGRAPHY_VERSION = 'atlas-world-v1';
export const CARTOGRAPHY_MANIFEST = { version: CARTOGRAPHY_VERSION, source: 'Natural Earth public domain', projection: 'equirectangular-safe-fit', tolerance: 0.5 } as const;
export type GeographicAnchor = { latitude: number; longitude: number };
/** Returns percentage co-ordinates inside the bundled world scene, or null for invalid evidence. */
export function projectAtlasAnchor(anchor: GeographicAnchor): { x: number; y: number } | null {
  if (!Number.isFinite(anchor.latitude) || !Number.isFinite(anchor.longitude) || anchor.latitude < -90 || anchor.latitude > 90 || anchor.longitude < -180 || anchor.longitude > 180) return null;
  return { x: 50 + (anchor.longitude / 360) * 92, y: 50 - (anchor.latitude / 180) * 62 };
}
