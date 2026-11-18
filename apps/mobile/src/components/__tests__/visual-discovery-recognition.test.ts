import { createVisualRecognition, VisualPlaceError, type VisualCluster } from '@/visual-place/recovery';
import { ewhaCampusComplex } from '@/visual-place/place-catalog';

const cluster: VisualCluster = {
  token: {},
  observedPeriod: 'Synthetic period',
  photos: [
    { id: 'photo-1', uri: 'file:///synthetic-private-first' },
    { id: 'photo-2', uri: 'file:///synthetic-private-second' },
    { id: 'photo-3', uri: 'file:///synthetic-private-third' },
  ],
};
const consent = { approvedOnDeviceAnalysis: true, selectedIds: cluster.photos.map(({ id }) => id) };
const signal = new AbortController().signal;
const allow = async () => true;
const correlationId = 'runtime-cap4synthetic-1';

it('separates recognized place evidence from other usable album representatives', async () => {
  const read = jest.fn()
    .mockResolvedValueOnce(['EWHA WOMANS UNIVERSITY'])
    .mockRejectedValueOnce(new VisualPlaceError('MEDIA_DECODE'))
    .mockResolvedValueOnce(['generic street scene']);
  const logs = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const result = await createVisualRecognition(read)(cluster, consent, allow, signal, { correlationId });
    expect(result).toMatchObject({
      status: 'recognized',
      observations: [
        { id: 'photo-1', placeId: 'ewha-womans-university', kind: 'signage' },
        { id: 'photo-3', placeId: null, kind: null },
      ],
    });
    const events = logs.mock.calls.map((call) => call[1]);
    expect(events).toEqual([
      expect.objectContaining({ stage: 'RECOGNITION', reasonCode: 'START', correlationId }),
      expect.objectContaining({ stage: 'RESULT_VALIDATE', reasonCode: 'COMPLETE', correlationId }),
    ]);
    expect(JSON.stringify(events)).not.toMatch(/synthetic-private|EWHA|generic street scene/);
  } finally {
    logs.mockRestore();
  }
});

it('preserves separate place observations for trip qualification', async () => {
  const scenario = (second: string) => createVisualRecognition(jest.fn()
    .mockResolvedValueOnce(['이화여자대학교'])
    .mockResolvedValueOnce([second])
    .mockResolvedValueOnce([]))(cluster, consent, allow, signal, { correlationId });
  await expect(scenario('경복궁')).resolves.toMatchObject({
    status: 'recognized', observations: [
      { id: 'photo-1', placeId: 'ewha-womans-university' }, { id: 'photo-2', placeId: 'gyeongbokgung-palace' }, { id: 'photo-3', placeId: null },
    ],
  });
  await expect(scenario('Taipei 101')).resolves.toMatchObject({ status: 'recognized',
    observations: expect.arrayContaining([{ id: 'photo-2', placeId: 'taipei-101', kind: 'signage' }]) });
});

it('reports a closed reason for each abstention without exposing recognized text or photo references', async () => {
  const logs = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const checks = [
      { texts: [' ', '… !'], reasonCode: 'VISUAL_NO_READABLE_TEXT' },
      { texts: ['private-model-sentinel', 'generic street'], reasonCode: 'VISUAL_NO_PLACE_MATCH' },
      { texts: ['Taipei 101\nEWHA WOMANS UNIVERSITY', 'generic street'], reasonCode: 'VISUAL_PLACE_CONFLICT' },
    ];
    for (const { texts, reasonCode } of checks) {
      logs.mockClear();
      const read = jest.fn().mockResolvedValueOnce([texts[0]]).mockResolvedValueOnce([texts[1]]).mockResolvedValueOnce([]);
      await expect(createVisualRecognition(read)(cluster, consent, allow, signal, { correlationId }))
        .resolves.toEqual({ status: 'inconclusive' });
      const events = logs.mock.calls.map((call) => call[1]);
      expect(events.filter((event) => event.stage === 'RESULT_VALIDATE')).toEqual([
        expect.objectContaining({ correlationId, reasonCode, durableOutcome: 'skipped', retryable: false }),
      ]);
      expect(JSON.stringify(events)).not.toMatch(/synthetic-private|private-model-sentinel|EWHA|Taipei/);
    }
  } finally {
    logs.mockRestore();
  }
});

it('continues image recognition after an accepted OCR match, preserving separate stop clues', async () => {
  const read = jest.fn().mockResolvedValueOnce(['남산타워']).mockResolvedValue(['private OCR sentinel']);
  const landmark = jest.fn().mockResolvedValueOnce({ place: null }).mockResolvedValueOnce({ place: ewhaCampusComplex }).mockResolvedValueOnce({ place: null });
  const logs = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const recognize = createVisualRecognition(read, undefined, landmark);
    await expect(recognize(cluster, consent, allow, signal, { correlationId })).resolves.toMatchObject({
      status: 'recognized', observations: [
        { id: 'photo-1', placeId: 'namsan-seoul-tower', kind: 'signage' },
        { id: 'photo-2', placeId: 'ewha-womans-university', kind: 'image' },
        { id: 'photo-3', placeId: null, kind: null },
      ],
    });
    expect(landmark.mock.calls.map(([uri]) => uri)).toEqual(cluster.photos.map(({ uri }) => uri));
    const events = logs.mock.calls.map((call) => call[1]);
    expect(events).toContainEqual(expect.objectContaining({ stage: 'LANDMARK_MATCH', reasonCode: 'COMPLETE', correlationId }));
    expect(JSON.stringify(events)).not.toMatch(/private OCR|synthetic-private|Ewha/);
  } finally {
    logs.mockRestore();
  }
});

it('does not use image evidence to override conflicting text or bypass permission', async () => {
  const landmark = jest.fn();
  const recognize = createVisualRecognition(jest.fn().mockResolvedValue(['Ewha Womans University', 'Taipei 101']), undefined, landmark);
  const auto = { correlationId };
  await expect(recognize(cluster, consent, allow, signal, auto)).resolves.toEqual({ status: 'inconclusive' });
  await expect(recognize(cluster, { ...consent, approvedOnDeviceAnalysis: false }, allow, signal, auto)).resolves.toEqual({ status: 'retry' });
  expect(landmark).not.toHaveBeenCalled();
});

it('discards image results on withdrawal and classifies a missed or failed image read without raw data', async () => {
  const logs = jest.spyOn(console, 'info').mockImplementation(() => {});
  try {
    const landmark = jest.fn().mockRejectedValueOnce(new VisualPlaceError('MEDIA_DECODE')).mockResolvedValue({ place: null });
    const auto = { correlationId };
    await expect(createVisualRecognition(null, undefined, landmark)(cluster, consent, allow, signal, auto))
      .resolves.toEqual({ status: 'inconclusive' });
    const events = logs.mock.calls.map((call) => call[1]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'LANDMARK_MATCH', reasonCode: 'MEDIA_DECODE', correlationId }),
      expect.objectContaining({ stage: 'LANDMARK_MATCH', reasonCode: 'VISUAL_NO_LANDMARK_MATCH', correlationId }),
    ]));
    const revoked = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const match = jest.fn().mockResolvedValue({ place: ewhaCampusComplex });
    await expect(createVisualRecognition(null, undefined, match)(cluster, consent, revoked, signal, auto))
      .resolves.toEqual({ status: 'stale' });
    expect(match).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs.mock.calls)).not.toMatch(/synthetic-private|Ewha/);
  } finally {
    logs.mockRestore();
  }
});

it('aborts the image reader when its deadline expires and withholds the late match', async () => {
  const logs = jest.spyOn(console, 'info').mockImplementation(() => {});
  let finish!: (result: { place: typeof ewhaCampusComplex }) => void;
  const landmark = jest.fn<Promise<{ place: typeof ewhaCampusComplex }>, [string, AbortSignal]>(() =>
    new Promise<{ place: typeof ewhaCampusComplex }>((resolve) => { finish = resolve; }));
  const auto = { correlationId };
  const recognize = createVisualRecognition(null, 15, landmark);
  try {
    await expect(recognize(cluster, consent, allow, signal, auto)).resolves.toEqual({ status: 'retry' });
    expect(landmark.mock.calls[0][1].aborted).toBe(true);
    await expect(recognize(cluster, consent, allow, signal, auto)).resolves.toEqual({ status: 'retry' });
    expect(landmark).toHaveBeenCalledTimes(1);
    finish({ place: ewhaCampusComplex });
    await Promise.resolve();
    expect(logs.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ stage: 'LANDMARK_MATCH', reasonCode: 'START', correlationId }),
      expect.objectContaining({ stage: 'LANDMARK_MATCH', reasonCode: 'HISTORY_READ_TIMEOUT', correlationId }),
      expect.objectContaining({ stage: 'LANDMARK_MATCH', reasonCode: 'ALREADY_RUNNING', correlationId }),
    ]);
  } finally {
    logs.mockRestore();
  }
});

it('reports an unavailable model before touching the photos', async () => {
  const logs = jest.spyOn(console, 'info').mockImplementation(() => {});
  const landmark = jest.fn();
  const prepare = jest.fn().mockRejectedValue(new VisualPlaceError('MEDIA_UNAVAILABLE'));
  try {
    const recognize = createVisualRecognition(null, undefined, landmark, prepare);
    await expect(recognize(cluster, consent, allow, signal, { correlationId }))
      .resolves.toEqual({ status: 'unavailable' });
    expect(landmark).not.toHaveBeenCalled();
    expect(logs.mock.calls.map((call) => call[1])).toEqual([
      expect.objectContaining({ stage: 'LANDMARK_MODEL', reasonCode: 'START', correlationId }),
      expect.objectContaining({ stage: 'LANDMARK_MODEL', reasonCode: 'MEDIA_UNAVAILABLE', correlationId }),
    ]);
  } finally {
    logs.mockRestore();
  }
});
