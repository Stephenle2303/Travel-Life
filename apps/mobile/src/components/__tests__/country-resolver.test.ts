import { NATURAL_EARTH_ADMIN_0_DATASET_VERSION, countryDisplayName, resolveCountry } from '@/reconstruction/country-resolver';

describe('offline Natural Earth country resolver', () => {
  it('resolves only a local code from a clearly interior synthetic coordinate', () => {
    expect(NATURAL_EARTH_ADMIN_0_DATASET_VERSION).toBe('5.1.1-10m-0.001deg-4dp');
    expect(resolveCountry({ latitude: 13.7563, longitude: 100.5018 })).toEqual({ status: 'resolved', code: 'THA' });
  });

  it('omits invalid and border-ambiguous coordinates without a fallback', () => {
    expect(resolveCountry({ latitude: 91, longitude: 100 })).toEqual({ status: 'invalid' });
    expect(resolveCountry({ latitude: 0, longitude: -140 })).toEqual({ status: 'unresolved' });
  });

  it('maps a resolved code to a bundled display name without consulting a geocoder', () => {
    expect(countryDisplayName('THA')).toBe('Thailand');
    expect(countryDisplayName('not-a-country')).toBeNull();
  });
});
