export type AtlasBasemapConfig =
  | { enabled: true; styleUrl: string }
  | { enabled: false; reason: 'missing' | 'invalid' };

/**
 * The provider URL is publishable build configuration. Keeping parsing here makes
 * the absent-config path explicit and prevents a development style from leaking
 * into a release build.
 */
export function parseAtlasBasemapStyle(value: string | undefined | null): AtlasBasemapConfig {
  const candidate = value?.trim();
  if (!candidate) return { enabled: false, reason: 'missing' };

  try {
    const url = new URL(candidate);
    const isMapTilerStyle = url.hostname === 'api.maptiler.com' && /^\/maps\/[^/]+\/style\.json$/.test(url.pathname) && Boolean(url.searchParams.get('key'));
    if (url.protocol !== 'https:' || !isMapTilerStyle) {
      return { enabled: false, reason: 'invalid' };
    }
    return { enabled: true, styleUrl: url.toString() };
  } catch {
    return { enabled: false, reason: 'invalid' };
  }
}

export function atlasBasemapConfig(): AtlasBasemapConfig {
  return parseAtlasBasemapStyle(process.env.EXPO_PUBLIC_ATLAS_MAP_STYLE_URL);
}
