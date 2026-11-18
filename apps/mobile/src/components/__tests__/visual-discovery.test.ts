import { advanceVisualDiscovery, initialVisualDiscovery, visualDiscoveryPhotoAttempts, visualDiscoveryTextAttempts, type DiscoveryPhoto } from '@/visual-place/discovery';
import { ewhaCampusComplex } from '@/visual-place/place-catalog';
import { createVisualRecognition } from '@/visual-place/recovery';

function photo(index: number, capturedAt: number, family = `family-${index}`): DiscoveryPhoto {
  return {
    evidence_id: `synthetic-${index}`,
    source_ref: `synthetic-ref-${index}`,
    captured_at_millis: capturedAt,
    captured_day: new Date(capturedAt).toISOString().slice(0, 10),
    family,
  };
}

it('discovers a six-day dense episode across pages and recognizes a clue outside the original sample', async () => {
  const day = 86_400_000;
  const firstDay = Date.UTC(2025, 5, 1, 9);
  const rows = Array.from({ length: 471 }, (_, index) =>
    photo(index, firstDay + Math.floor(index / 79) * day + (index % 79) * 6 * 60_000)).reverse();
  const onePage = advanceVisualDiscovery(initialVisualDiscovery(), rows, true);
  expect(onePage.candidate?.start).toBe('2025-06-01');
  expect(onePage.candidate?.end).toBe('2025-06-06');
  expect(onePage.candidate?.representatives).toHaveLength(visualDiscoveryPhotoAttempts);
  expect(new Set(onePage.candidate?.representatives.map(({ captured_day }) => captured_day)).size).toBe(6);
  const photos = onePage.candidate!.representatives.map(({ evidence_id }) => ({ id: evidence_id, uri: `file:///synthetic/${evidence_id}` }));
  const clue = photos[17];
  expect(photos.slice(0, 12)).not.toContain(clue);
  const analyze = (sample: typeof photos) => createVisualRecognition(async (uri) => uri === clue.uri ? ['EWHA WOMANS UNIVERSITY'] : [])(
    { token: {}, observedPeriod: 'Synthetic period', photos: sample },
    { approvedOnDeviceAnalysis: true, selectedIds: sample.map(({ id }) => id) },
    async () => true, new AbortController().signal,
    { correlationId: 'synthetic_dense_scan' },
  );
  await expect(analyze(photos.slice(0, 12))).resolves.toEqual({ status: 'inconclusive' });
  await expect(analyze(photos)).resolves.toMatchObject({ status: 'recognized', observations: expect.arrayContaining([
    { id: clue.id, placeId: 'ewha-womans-university', kind: 'signage' },
  ]) });

  const imageClue = photos[visualDiscoveryTextAttempts + 17];
  const readText = jest.fn().mockResolvedValue([]);
  const readImage = jest.fn(async (uri: string) => ({ place: uri === imageClue.uri ? ewhaCampusComplex : null }));
  const recognize = createVisualRecognition(readText, undefined, readImage);
  await expect(recognize({ token: {}, observedPeriod: 'Synthetic period', photos },
    { approvedOnDeviceAnalysis: true, selectedIds: photos.map(({ id }) => id) }, async () => true, new AbortController().signal,
    { correlationId: 'synthetic_dense_scan' },
  )).resolves.toMatchObject({ status: 'recognized', observations: expect.arrayContaining([
    expect.objectContaining({ id: imageClue.id, placeId: 'ewha-womans-university', kind: 'image' }),
  ]) });
  expect(readText).toHaveBeenCalledTimes(visualDiscoveryTextAttempts);
  expect(readText).not.toHaveBeenCalledWith(imageClue.uri);
  expect(readImage).toHaveBeenCalledTimes(visualDiscoveryPhotoAttempts);
  expect(new Set(photos.map(({ id }) => id)).size).toBe(visualDiscoveryPhotoAttempts);

  let checkpoint = initialVisualDiscovery();
  for (let offset = 0; offset < rows.length; offset += 37) {
    const last = offset + 37 >= rows.length;
    const step = advanceVisualDiscovery(checkpoint, rows.slice(offset, offset + 37), last);
    expect(step.next.tail.length).toBeLessThan(40);
    expect(step.next.coverage.length).toBeLessThanOrEqual(offset + 37);
    expect(step.candidate).toEqual(last ? onePage.candidate : null);
    checkpoint = step.next;
  }
  expect(checkpoint.complete).toBe(true);
});

it('abstains for a duplicate-only group and for an uninterrupted long stretch of routine photos', () => {
  const start = Date.UTC(2025, 5, 1, 9);
  const duplicated = Array.from({ length: 30 }, (_, index) => photo(index, start + index * 3_600_000, 'duplicate')).reverse();
  const continuous = Array.from({ length: 600 }, (_, index) => photo(index, start + index * 3_600_000)).reverse();
  expect(advanceVisualDiscovery(initialVisualDiscovery(), duplicated, true).candidate).toBeNull();
  expect(advanceVisualDiscovery(initialVisualDiscovery(), continuous, true).candidate).toBeNull();
});

it('keeps separate capture runs available on either side of a gap', () => {
  const start = Date.UTC(2025, 5, 1, 9);
  const earlier = [0, 1, 180, 181].map((minute, index) => photo(index, start + minute * 60_000)).reverse();
  const later = [0, 1, 180, 181].map((minute, index) => photo(index + 4, start + 3 * 86_400_000 + minute * 60_000)).reverse();
  const first = advanceVisualDiscovery(initialVisualDiscovery(), [...later, ...earlier], true);
  expect(first.candidate?.start).toBe('2025-06-04');
  expect(first.next.complete).toBe(false);
  expect(first.next.cursor?.evidence_id).toBe('synthetic-4');
  const next = advanceVisualDiscovery(first.next, earlier, true);
  expect(next.candidate?.start).toBe('2025-06-01');
  expect(next.next.complete).toBe(true);
});
