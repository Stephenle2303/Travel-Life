import { searchOwnerPlaces } from '@/reconstruction/owner-place-search';

describe('searchOwnerPlaces', () => {
  it('keeps Phú Quốc as a reviewed special place and searches the bundled worldwide regional gazetteer', () => {
    expect(searchOwnerPlaces('Phu Quoc')).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'wikidata:Q146695', name: 'Phú Quốc' })]));
    expect(searchOwnerPlaces('Tokyo')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Tokyo', context: 'Japan' })]));
    expect(searchOwnerPlaces('Bali')).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Bali', context: 'Indonesia' })]));
  });
});
