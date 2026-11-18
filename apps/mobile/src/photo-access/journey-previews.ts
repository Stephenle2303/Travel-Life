import type { OwnerPreview, PhotoAccessAdapter } from './types';

export class JourneyPreviewError extends Error {
  constructor(readonly reason: 'HISTORY_STALE' | 'MEDIA_VERIFY' | 'MEDIA_ACCESS') {
    super('Journey media could not be verified.');
  }
}

export async function resolveBoundJourneyPreviews(
  adapter: PhotoAccessAdapter,
  references: (string | null)[],
  current: () => boolean,
  verify: () => Promise<boolean>,
): Promise<OwnerPreview[]> {
  if (!current()) throw new JourneyPreviewError('HISTORY_STALE');
  if (!references.some(Boolean) || !adapter.resolveOwnerPreviews) return [];
  const result = await adapter.resolveOwnerPreviews(references, references.length);
  if (!current() || !await verify() || !current()) throw new JourneyPreviewError('HISTORY_STALE');
  if (result.length !== references.length) throw new JourneyPreviewError('MEDIA_VERIFY');
  return result.map((preview, index) => references[index] && preview.availability === 'available' && preview.uri
    ? preview : { kind: preview.kind, uri: null, availability: 'unavailable' });
}
