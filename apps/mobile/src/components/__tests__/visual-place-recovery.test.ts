import { createVisualRecognition, ewhaPlace, VisualPlaceError, type VisualCluster } from '@/visual-place/recovery';
import { visualOffers, type VisualEvidence } from '@/visual-place/local-eligibility';

const cluster: VisualCluster = { token: {}, observedPeriod: 'January 2026', photos: [
  { id: 'photo-1', uri: 'file:///synthetic-private-photo.jpg' },
  { id: 'photo-2', uri: 'content://synthetic/private-2' },
] };
const allow = async () => true;
const consent = { approvedOnDeviceAnalysis: true, selectedIds: ['photo-2'] };

it('requires an exact owner-selected subset and passes only those local images to recognition', async () => {
  const read = jest.fn(async () => ['이화여자대학교']);
  const recognize = createVisualRecognition(read);
  const signal = new AbortController().signal;
  await expect(recognize(cluster, { ...consent, approvedOnDeviceAnalysis: false }, allow, signal)).resolves.toEqual({ status: 'retry' });
  await expect(recognize(cluster, { ...consent, selectedIds: ['photo-2', 'photo-2'] }, allow, signal)).resolves.toEqual({ status: 'retry' });
  await expect(recognize(cluster, { ...consent, selectedIds: ['foreign'] }, allow, signal)).resolves.toEqual({ status: 'retry' });
  expect(read).not.toHaveBeenCalled();
  await expect(recognize(cluster, consent, allow, signal)).resolves.toEqual({ status: 'proposed', place: ewhaPlace, selectedIds: ['photo-2'] });
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith(cluster.photos[1].uri);
});

it('abstains for generic interiors, secondary campuses and signs for directions', async () => {
  const signal = new AbortController().signal;
  for (const text of ['generic corridor', 'Ewha Womans University Mokdong Hospital', 'Ewha Womans University campus map', '이화여대역 이화여자대학교']) {
    const recognize = createVisualRecognition(async () => [text]);
    await expect(recognize(cluster, consent, allow, signal)).resolves.toEqual({ status: 'inconclusive' });
  }
});

it('discards stale or cancelled results and emits only closed diagnostics', async () => {
  const logs = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const stale = jest.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
    await expect(createVisualRecognition(async () => ['Ewha Womans University'])(cluster, consent, stale, new AbortController().signal)).resolves.toEqual({ status: 'stale' });
    const controller = new AbortController();
    const read = jest.fn(() => new Promise((resolve) => { controller.abort(); resolve(['Ewha Womans University']); }));
    await expect(createVisualRecognition(read)(cluster, consent, allow, controller.signal)).resolves.toEqual({ status: 'cancelled' });
    await expect(createVisualRecognition(async () => ({ hostile: 'synthetic-ocr-sentinel' }))(cluster, consent, allow, new AbortController().signal)).resolves.toEqual({ status: 'retry' });
    const events = logs.mock.calls.map((call) => call[1]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ operation: 'VISUAL_PLACE_REVIEW', stage: 'MEDIA_SCOPE', reasonCode: 'HISTORY_STALE' }),
      expect.objectContaining({ operation: 'VISUAL_PLACE_REVIEW', stage: 'RECOGNITION', reasonCode: 'SKIPPED' }),
      expect.objectContaining({ operation: 'VISUAL_PLACE_REVIEW', stage: 'RESULT_VALIDATE', reasonCode: 'MEDIA_SCHEMA' }),
    ]));
    expect(JSON.stringify(events)).not.toMatch(/synthetic-ocr-sentinel|synthetic-private-photo|Ewha/);
    expect(events[0].correlationId).toBe(events[1].correlationId);
  } finally {
    logs.mockRestore();
  }
});

it('withholds a late result and keeps the native slot fenced after the recognition deadline', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  let finish!: (result: unknown) => void;
  const read = jest.fn(() => new Promise<unknown>((resolve) => { finish = resolve; }));
  const recognize = createVisualRecognition(read, 10);
  const signal = new AbortController().signal;
  try {
    await expect(recognize(cluster, consent, allow, signal)).resolves.toEqual({ status: 'retry' });
    await expect(recognize(cluster, consent, allow, signal)).resolves.toEqual({ status: 'retry' });
    expect(read).toHaveBeenCalledTimes(1);
    const events = log.mock.calls.map(([, event]) => event);
    expect(events.map(({ stage, reasonCode }) => [stage, reasonCode])).toEqual([
      ['RECOGNITION', 'START'],
      ['RECOGNITION', 'HISTORY_READ_TIMEOUT'],
      ['RECOGNITION', 'ALREADY_RUNNING'],
    ]);
    expect(events[0].correlationId).toBe(events[1].correlationId);
    expect(events[1]).toMatchObject({ retryable: true, durableOutcome: 'unchanged' });
    finish(['Ewha Womans University', 'synthetic-late-ocr-sentinel']);
    await Promise.resolve();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/synthetic-late-ocr-sentinel|Ewha/);
    expect(log).toHaveBeenCalledTimes(3);
  } finally { log.mockRestore(); }
});

it('retains a recognized clue after one undecodable representative for trip qualification', async () => {
  const log = jest.spyOn(console, 'info').mockImplementation(() => {});
  const signal = new AbortController().signal;
  try {
    const recognize = createVisualRecognition(jest.fn()
      .mockRejectedValueOnce(new VisualPlaceError('MEDIA_DECODE'))
      .mockResolvedValueOnce(['Ewha Womans University']));
    const result = await recognize(cluster, { ...consent, selectedIds: ['photo-1', 'photo-2'] }, allow, signal,
      { correlationId: 'local_decode_control' });
    expect(result).toEqual({ status: 'recognized', observations: [{ id: 'photo-2', placeId: ewhaPlace.id, kind: 'signage' }] });
    expect(log.mock.calls.map(([, event]) => event)).toEqual([
      expect.objectContaining({ stage: 'RECOGNITION', reasonCode: 'START', correlationId: 'local_decode_control' }),
      expect.objectContaining({ stage: 'RESULT_VALIDATE', reasonCode: 'COMPLETE', correlationId: 'local_decode_control' }),
    ]);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/synthetic-private-photo|Ewha/);
  } finally { log.mockRestore(); }
});

it('offers bounded, independently timed representatives and rejects duplicate-only groups', () => {
  const rows: VisualEvidence[] = Array.from({ length: 5 }, (_, index) => ({
    evidence_id: `synthetic-${index}`, source_ref: `ref-${index}`, captured_day: '2026-01-02',
    captured_at_millis: Date.UTC(2026, 0, 2, 12 - index), family: `family-${index}`,
  }));
  const offers = visualOffers(rows);
  expect(offers[0].photos).toHaveLength(4);
  expect(visualOffers(rows.map((row) => ({ ...row, family: 'same-family' })))).toEqual([]);
  expect(visualOffers(rows.map((row) => ({ ...row, captured_at_millis: 50 })))).toEqual([]);
});
