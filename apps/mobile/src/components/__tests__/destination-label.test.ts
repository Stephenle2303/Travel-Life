import { destinationLabel } from '@/reconstruction/destination-label';
import { resolveDestination } from '@/reconstruction/country-resolver';
import dataset from '@/reconstruction/data/natural-earth-destinations-5.1.1.json';

const bali = { latitude: -8.5069, longitude: 115.2625 };
const kuta = { latitude: -8.717, longitude: 115.19 };

describe('supported offline destinations', () => {
  it('bounds point-invariant trigonometry by areas rather than polygon edges', () => {
    const cosine = jest.spyOn(Math, 'cos');
    try {
      expect(resolveDestination(bali)).toMatchObject({ code: 'IDN', country: 'Indonesia', region: 'Bali' });
      const candidateAreas = dataset.countries.length + dataset.regions.filter((region) => region.code === 'IDN').length;
      expect(cosine.mock.calls.length).toBeLessThanOrEqual(candidateAreas);
    } finally {
      cosine.mockRestore();
    }
  });

  it('keeps conflicting duplicate support withheld in either encounter order', () => {
    const support = [
      { placeId: 'p', familyId: 'duplicate', ...bali },
      { placeId: 'p', familyId: 'independent', ...bali },
      { placeId: 'p', familyId: 'duplicate', latitude: 35.6762, longitude: 139.6503 },
      { placeId: 'p', familyId: 'duplicate', ...bali },
    ];
    expect(destinationLabel(support)).toBe('Private journey');
    expect(destinationLabel([...support].reverse())).toBe('Private journey');
    expect(destinationLabel(support.map((item) => ({ ...item, reportedAccuracyMeters: 1001 })))).toBe('Private journey');
  });

  it('resolves public Bali samples and other countries without a network service', () => {
    expect(resolveDestination(bali)).toMatchObject({ code: 'IDN', country: 'Indonesia', region: 'Bali' });
    expect(resolveDestination(kuta)).toMatchObject({ code: 'IDN', country: 'Indonesia', region: 'Bali' });
    expect(resolveDestination({ latitude: 35.6762, longitude: 139.6503 })).toMatchObject({ code: 'JPN', country: 'Japan' });
    expect(resolveDestination({ latitude: 48.8566, longitude: 2.3522 })).toMatchObject({ code: 'FRA', country: 'France' });
  });

  it('requires two independent support families and never names from one point', () => {
    const support = [{ placeId: 'p', familyId: 'a', ...bali }, { placeId: 'p', familyId: 'b', latitude: -8.51, longitude: 115.26 }];
    expect(destinationLabel(support)).toBe('Bali, Indonesia');
    expect(destinationLabel(support.slice(0, 1))).toBe('Private journey');
    expect(destinationLabel(support.map((item) => ({ ...item, familyId: 'a' })))).toBe('Private journey');
  });

  it('abstains on invalid, offshore and very uncertain positions', () => {
    expect(resolveDestination({ latitude: 91, longitude: 0 })).toBeNull();
    expect(resolveDestination({ latitude: 0, longitude: -140 })).toBeNull();
    expect(resolveDestination({ latitude: -8.717, longitude: 115.174 })).toBeNull();
    expect(resolveDestination({ ...bali, reportedAccuracyMeters: 100000 })).toBeNull();
    expect(destinationLabel([{ placeId: 'p', familyId: 'a', ...bali }, { placeId: 'p', familyId: 'b', latitude: 21.0285, longitude: 105.8542 }])).toBe('Private journey');
  });

  it('uses country fallback for mixed regions and retains multiple supported countries', () => {
    const pair = (placeId: string, latitude: number, longitude: number) => ['a', 'b'].map((suffix) => ({ placeId, familyId: `${placeId}-${suffix}`, latitude, longitude }));
    expect(destinationLabel([...pair('bali', -8.5069, 115.2625), ...pair('jakarta', -6.2088, 106.8456)])).toBe('Indonesia');
    expect(destinationLabel([...pair('bali', -8.5069, 115.2625), ...pair('hanoi', 21.0285, 105.8542)])).toBe('Indonesia & Vietnam');
  });
});
