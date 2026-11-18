import { destinationLabel } from '@/reconstruction/destination-label';
import { resolveDestination } from '@/reconstruction/country-resolver';

const bali = { latitude: -8.5069, longitude: 115.2625 };
const kuta = { latitude: -8.717, longitude: 115.19 };

describe('supported offline destinations', () => {
  it.each([
    ['Sa Đéc', 10.3, 105.7667],
    ['Sa Đéc', 10.29085, 105.75635],
    ['Cần Thơ', 10.03711, 105.78825],
    ['Cần Thơ', 10.0452, 105.7469],
    ['Huế', 16.4619, 107.59546],
    ['Hà Nội', 21.0285, 105.8542],
    ['Đà Lạt', 11.94646, 108.44193],
    ['Nha Trang', 12.24507, 109.19432],
    ['Vinh', 18.67337, 105.69232],
    ['Vũng Tàu', 10.34599, 107.08426],
  ])('labels the corroborated %s public control within the reviewed footprint', async (region, latitude, longitude) => {
    const point = { latitude, longitude };
    expect(resolveDestination(point)).toEqual({ code: 'VNM', country: 'Vietnam', region });
    const support = ['a', 'b'].map((familyId) => ({ placeId: 'p', familyId, ...point }));
    expect(await destinationLabel(support)).toBe(`${region}, Vietnam`);
    expect(await destinationLabel(support.slice(0, 1))).toBe('Private journey');
  });

  it('uses country fallback outside verified localities and on a district footprint edge', async () => {
    const points = [{ latitude: 21.32274, longitude: 105.40198 }, { latitude: 10.2944, longitude: 105.7838 }];
    for (const point of points) {
      expect(resolveDestination(point)).toEqual({ code: 'VNM', country: 'Vietnam', region: null });
      expect(await destinationLabel(['a', 'b'].map((familyId) => ({ placeId: 'p', familyId, ...point })))).toBe('Vietnam');
    }
    expect(await destinationLabel([
      { placeId: 'p', familyId: 'a', latitude: 10.29085, longitude: 105.75635 },
      { placeId: 'p', familyId: 'b', latitude: 10.03711, longitude: 105.78825 },
    ])).toBe('Vietnam');
  });

  it('keeps verified Vietnamese stops visible when a different stop resolves only to the country', async () => {
    const pair = (placeId: string, latitude: number, longitude: number) => ['a', 'b']
      .map((suffix) => ({ placeId, familyId: `${placeId}-${suffix}`, latitude, longitude }));
    const support = [
      ...pair('hue', 16.4619, 107.59546), ...pair('sa-dec', 10.3, 105.7667),
      ...pair('viet-tri', 21.32274, 105.40198),
    ];
    expect(await destinationLabel(support)).toBe('Huế · Sa Đéc, Vietnam');
    const three = [...support, ...pair('hanoi', 21.0285, 105.8542)];
    expect(await destinationLabel(three)).toBe('Huế · Hà Nội +1');
    expect(await destinationLabel([...three].reverse(), true)).toBe('Huế · Hà Nội · Sa Đéc, Vietnam');
  });

  it('uses the archived province layer only for supported capture dates', async () => {
    const archived = { latitude: 21.32274, longitude: 105.40198, capturedDay: '2024-01-10' };
    const retired = { ...archived, capturedDay: '2025-01-01' };
    expect(resolveDestination(archived)).toMatchObject({ region: 'Phú Thọ' });
    expect(resolveDestination(retired)).toMatchObject({ region: null });
    expect(resolveDestination({ ...archived, capturedDay: '2020-01-02' })).toMatchObject({ region: null });
    const support = ['a', 'b'].map((familyId) => ({ placeId: 'p', familyId, ...archived }));
    expect(await destinationLabel(support)).toBe('Phú Thọ, Vietnam');
    expect(await destinationLabel(support.map((item) => ({ ...item, ...retired })))).toBe('Vietnam');
  });

  it('prefers the supported locality and retains its historical parent where appropriate', () => {
    expect(resolveDestination({ latitude: 16.4619, longitude: 107.59546, capturedDay: '2024-01-10' }))
      .toMatchObject({ region: 'Huế', parentRegion: 'Thừa Thiên Huế' });
    expect(resolveDestination({ latitude: 16.33333, longitude: 107.58333, capturedDay: '2024-01-10' }))
      .toMatchObject({ region: 'Thừa Thiên Huế' });
  });

  it('lets a pending input task run while processing one journey', async () => {
    let now = 0;
    let inputProcessed = false;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => (now += 20));
    try {
      setTimeout(() => { inputProcessed = true; }, 0);
      const support = ['a', 'b'].map((familyId) => ({ placeId: 'p', familyId, ...bali }));
      expect(await destinationLabel(support)).toBe('Bali, Indonesia');
      expect(inputProcessed).toBe(true);
    } finally {
      clock.mockRestore();
    }
  });
  it('computes point geometry once for country and region lookup', () => {
    const cosine = jest.spyOn(Math, 'cos');
    try {
      expect(resolveDestination(bali)).toMatchObject({ code: 'IDN', country: 'Indonesia', region: 'Bali' });
      expect(cosine).toHaveBeenCalledTimes(1);
    } finally {
      cosine.mockRestore();
    }
  });

  it('reuses exact points across trips while fencing historical dates and accuracy', async () => {
    const cosine = jest.spyOn(Math, 'cos');
    const cache = new Map();
    const point = { latitude: 21.32274, longitude: 105.40198, capturedDay: '2024-01-10' };
    const pair = (item: typeof point) => ['a', 'b'].map((familyId) => ({ ...item, familyId, placeId: 'p' }));
    try {
      expect(await destinationLabel(pair(point), false, cache)).toBe('Phú Thọ, Vietnam');
      expect(await destinationLabel(pair({ ...point, capturedDay: '2024-03-10' }), false, cache)).toBe('Phú Thọ, Vietnam');
      expect(await destinationLabel(pair({ ...point, capturedDay: '2026-03-10' }), false, cache)).toBe('Vietnam');
      expect(await destinationLabel(pair(point).map((item) => ({ ...item, reportedAccuracyMeters: 1001 })), false, cache)).toBe('Private journey');
      expect(cosine).toHaveBeenCalledTimes(2);
    } finally { cosine.mockRestore(); }
  });

  it('keeps conflicting duplicate support withheld in either encounter order', async () => {
    const support = [
      { placeId: 'p', familyId: 'duplicate', ...bali },
      { placeId: 'p', familyId: 'independent', ...bali },
      { placeId: 'p', familyId: 'duplicate', latitude: 35.6762, longitude: 139.6503 },
      { placeId: 'p', familyId: 'duplicate', ...bali },
    ];
    expect(await destinationLabel(support)).toBe('Private journey');
    expect(await destinationLabel([...support].reverse())).toBe('Private journey');
    expect(await destinationLabel(support.map((item) => ({ ...item, reportedAccuracyMeters: 1001 })))).toBe('Private journey');
  });

  it('resolves public Bali samples and other countries without a network service', () => {
    expect(resolveDestination(bali)).toMatchObject({ code: 'IDN', country: 'Indonesia', region: 'Bali' });
    expect(resolveDestination(kuta)).toMatchObject({ code: 'IDN', country: 'Indonesia', region: 'Bali' });
    expect(resolveDestination({ latitude: 35.6762, longitude: 139.6503 })).toMatchObject({ code: 'JPN', country: 'Japan' });
    expect(resolveDestination({ latitude: 48.8566, longitude: 2.3522 })).toMatchObject({ code: 'FRA', country: 'France' });
  });

  it('requires two independent support families and never names from one point', async () => {
    const support = [{ placeId: 'p', familyId: 'a', ...bali }, { placeId: 'p', familyId: 'b', latitude: -8.51, longitude: 115.26 }];
    expect(await destinationLabel(support)).toBe('Bali, Indonesia');
    expect(await destinationLabel(support.slice(0, 1))).toBe('Private journey');
    expect(await destinationLabel(support.map((item) => ({ ...item, familyId: 'a' })))).toBe('Private journey');
  });

  it('abstains on invalid, offshore and very uncertain positions', async () => {
    expect(resolveDestination({ latitude: 91, longitude: 0 })).toBeNull();
    expect(resolveDestination({ latitude: 0, longitude: -140 })).toBeNull();
    expect(resolveDestination({ latitude: -8.717, longitude: 115.174 })).toBeNull();
    expect(resolveDestination({ ...bali, reportedAccuracyMeters: 100000 })).toBeNull();
    expect(await destinationLabel([{ placeId: 'p', familyId: 'a', ...bali }, { placeId: 'p', familyId: 'b', latitude: 21.0285, longitude: 105.8542 }])).toBe('Private journey');
  });

  it('uses country fallback for mixed regions and retains multiple supported countries', async () => {
    const pair = (placeId: string, latitude: number, longitude: number) => ['a', 'b'].map((suffix) => ({ placeId, familyId: `${placeId}-${suffix}`, latitude, longitude }));
    expect(await destinationLabel([...pair('bali', -8.5069, 115.2625), ...pair('jakarta', -6.2088, 106.8456)])).toBe('Indonesia');
    expect(await destinationLabel([...pair('bali', -8.5069, 115.2625), ...pair('hanoi', 21.0285, 105.8542)])).toBe('Indonesia & Vietnam');
  });
});
