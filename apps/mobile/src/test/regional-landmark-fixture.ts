import { createHash } from 'node:crypto';
import { regionalLandmarkDescriptor, regionalLandmarkModelSha256 } from '@/visual-place/regional-landmarks';

export function regionalFixtureEmbedding(axis: number) {
  const vector = Array.from({ length: 384 }, (_, index) => Number(index === axis));
  return { global: vector, pooled: vector, regions: Array.from({ length: 16 }, () => vector) };
}

export const regionalFixturePlaces = [
  { id: 'ewha', region: 'KR-11' }, { id: 'namsan', region: 'KR-11' },
  { id: 'turtle-tower', region: 'VN-HN' }, { id: 'khue-van-cac', region: 'VN-HN' },
];

export function regionalFixturePack(packId: string, indexes: number[], richer = false) {
  const places = indexes.map((index) => regionalFixturePlaces[index]);
  const descriptors = places.map((place) => {
    const axis = regionalFixturePlaces.indexOf(place) * 2;
    return { id: `reference-${axis}`, placeId: place.id, views: [regionalFixtureEmbedding(axis),
      ...(richer ? [regionalFixtureEmbedding(axis + 1)] : [])] };
  });
  return { version: 1, packId, descriptorVersion: regionalLandmarkDescriptor, places, descriptors };
}

export const fixtureSha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export const fixtureJson = (value: unknown) => Uint8Array.from(Buffer.from(JSON.stringify(value), 'utf8'));

export function regionalFixtureRelease() {
  const packs = [regionalFixturePack('starter', [0, 1, 2, 3]), regionalFixturePack('kr', [0, 1], true), regionalFixturePack('vn', [2, 3], true)];
  const files = new Map<string, Uint8Array>();
  const entries = packs.map((pack) => {
    const { packId, descriptorVersion, places } = pack;
    const bytes = fixtureJson(pack);
    files.set(`${descriptorVersion}-${packId}.json`, bytes);
    return { version: 1, packId, descriptorVersion, snapshot: 'public-test-release', countries: [...new Set(places.map(({ region }) => region.slice(0, 2)))],
      modelSha256: regionalLandmarkModelSha256, sourceManifestSha256: 'f'.repeat(64), size: bytes.length, sha256: fixtureSha256(bytes) };
  });
  const manifestName = 'regional-landmarks-v1.json';
  const manifest = { version: 1, qualified: true, packs: entries };
  const manifestBytes = fixtureJson(manifest);
  files.set(manifestName, manifestBytes);
  return { manifest, manifestName, manifestSha256: fixtureSha256(manifestBytes), files };
}
