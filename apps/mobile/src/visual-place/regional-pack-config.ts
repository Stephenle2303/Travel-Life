const digestPattern = /^[a-f0-9]{64}$/;
export const regionalLandmarkPolicyVersion = 'visual-regional-preview-v1';

export function isRegionalPackDigest(value: unknown): value is string {
  return typeof value === 'string' && digestPattern.test(value);
}

export function regionalPackPreviewConfig() {
  if (typeof __DEV__ === 'undefined' || !__DEV__
    || process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_PLACE_PREVIEW !== 'true'
    || process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_PREVIEW !== 'true') return null;
  const origin = process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_ORIGIN;
  const manifestSha256 = process.env.EXPO_PUBLIC_TRAVEL_LIFE_VISUAL_REGIONAL_MANIFEST_SHA256;
  const port = origin?.match(/^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})$/)?.[1];
  return port && Number(port) <= 65_535 && isRegionalPackDigest(manifestSha256) ? { origin: origin!, manifestSha256 } : null;
}
