import { NATURAL_EARTH_ADMIN_0_DATASET_VERSION, resolveCountry } from '@/reconstruction/country-resolver';

describe('offline Natural Earth country resolver', () => {
  it('resolves only a local code from a clearly interior synthetic coordinate', () => {
    expect(NATURAL_EARTH_ADMIN_0_DATASET_VERSION).toBe('5.1.1');
    expect(resolveCountry({ latitude: 13.7563, longitude: 100.5018 })).toEqual({ status: 'resolved', code: 'THA' });
  });

  it('omits invalid and border-ambiguous coordinates without a fallback', () => {
    expect(resolveCountry({ latitude: 91, longitude: 100 })).toEqual({ status: 'invalid' });
    // A bundled Thailand polygon edge is deterministic; an edge
    // point must remain ambiguous rather than resolve to a country.
    expect(resolveCountry({ latitude: 14.2732, longitude: 105.2188 })).not.toMatchObject({ status: 'resolved' });
  });
});
