import { searchHomePlaces } from '@/reconstruction/home-place-search';

describe('offline Home search', () => {
  it('finds the same gazetteer point with and without Vietnamese accents', () => {
    const expected = { id: 'geonames:1568212', name: 'Sa Đéc', latitude: 10.29085, longitude: 105.75635 };
    expect(searchHomePlaces('Sa Dec')).toContainEqual(expect.objectContaining(expected));
    expect(searchHomePlaces('Sa Đéc')).toEqual(searchHomePlaces('Sa Dec'));
    expect(searchHomePlaces('Sa Dec Dong Thap')).toContainEqual(expect.objectContaining(expected));
  });

  it('shows places at different levels with parent names and disambiguates namesakes', () => {
    expect(searchHomePlaces('dong thap')).toContainEqual(expect.objectContaining({ name: 'Đồng Tháp', level: 'Province' }));
    expect(searchHomePlaces('châu thành')).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'District', context: expect.stringContaining('Vietnam') }),
      expect.objectContaining({ level: 'District', context: expect.stringContaining('Vietnam') }),
    ]));
    expect(new Set(searchHomePlaces('châu thành').map(({ context }) => context)).size).toBeGreaterThan(1);
    expect(searchHomePlaces('Phường Tân Quy Đông')).toContainEqual(expect.objectContaining({ level: 'Ward' }));
    expect(searchHomePlaces('Xã Chiêu Yên')).toContainEqual(expect.objectContaining({ level: 'Commune / ward' }));
  });

  it('finds cities outside Vietnam and returns no result for unmatched text', () => {
    expect(searchHomePlaces('Paris France')).toContainEqual(expect.objectContaining({ name: 'Paris', context: expect.stringContaining('France') }));
    expect(searchHomePlaces('NoSuchPublicPlace123')).toEqual([]);
    expect(searchHomePlaces('')).toEqual([]);
  });
});
