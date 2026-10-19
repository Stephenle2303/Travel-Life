/** Must match scripts/build-atlas-cartography.py and the bundled asset manifest. */
export function projectWorldPoint(longitude: number, latitude: number) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  const lon = longitude * Math.PI / 180;
  const lat = latitude * Math.PI / 180;
  const alpha = Math.acos(Math.max(-1, Math.min(1, Math.cos(lat) * Math.cos(lon / 2))));
  const sinc = alpha < 1e-9 ? 1 : Math.sin(alpha) / alpha;
  const x = (lon * 2 / Math.PI + 2 * Math.cos(lat) * Math.sin(lon / 2) / sinc) / 2;
  const y = (lat + Math.sin(lat) / sinc) / 2;
  const scale = 2048 * .94 / (Math.PI + 2);
  // The common 2048 × 1280 atlas canvas intentionally stretches the raw
  // Winkel Tripel vertical range by 1.6. Keep this in lockstep with the
  // public raster, tile and boundary builders.
  return { x: .5 + x * scale / 2048, y: .5 - y * scale * 1.6 / 1280 };
}
