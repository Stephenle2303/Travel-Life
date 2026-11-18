import { canonicalVisualStop, compatibleVisualPhotoClues, ewhaCampusComplex, ewhaPlace, matchVisualSignage, resolveCommonVisualLocality, resolveVisualPlace } from '@/visual-place/place-catalog';

describe('local signage place resolution', () => {
  it.each([
    ['EWHA WOMAN’S UNIVERSITY', 'ewha-womans-university', 'Seoul, South Korea'],
    ['경 복 궁', 'gyeongbokgung-palace', 'Seoul, South Korea'],
    ['台北 １０１', 'taipei-101', 'Taipei, Taiwan'],
    ['ＴＯＫＹＯ ＳＫＹＴＲＥＥ', 'tokyo-skytree', 'Tokyo, Japan'],
    ['서울 특별시', 'seoul-municipal-signage', 'South Korea'],
  ])('resolves an exact OCR name with a public place anchor', (text, id, locality) => {
    const result = matchVisualSignage([text]);
    expect(result).toMatchObject({ id, locality });
    expect(resolveVisualPlace(id)).toMatchObject({
      id, latitude: expect.any(Number), longitude: expect.any(Number),
    });
  });

  it('abstains on indirect references, conflicts, unknown places and generic scenes', () => {
    expect(matchVisualSignage(['Taipei 101', 'Gyeongbokgung Palace'])).toBe('ambiguous');
    expect(matchVisualSignage(['Tokyo Skytree', 'Subway station'])).toBe('ambiguous');
    expect(matchVisualSignage(['Taipei 101', 'Poster'])).toBe('ambiguous');
    expect(matchVisualSignage(['Souvenir from Taipei 101'])).toBeNull();
    expect(matchVisualSignage(['Restaurant', 'Dinner menu'])).toBeNull();
    expect(matchVisualSignage(['SEOUL'])).toBeNull();
    expect(matchVisualSignage(['Seoul Metropolitan Government', 'Map'])).toBe('ambiguous');
    expect(matchVisualSignage(['서울특별시', '경복궁'])).toMatchObject({ id: 'gyeongbokgung-palace' });
    expect(matchVisualSignage(['서울특별시', 'Taipei 101'])).toBe('ambiguous');
    expect(resolveVisualPlace('unknown-model-output')).toBeNull();
  });

  it('uses city precision only for distinct landmark matches in the same city', () => {
    const palace = resolveVisualPlace('gyeongbokgung-palace')!;
    const taipei = resolveVisualPlace('taipei-101')!;
    expect(resolveCommonVisualLocality([ewhaPlace, palace])).toMatchObject({ id: 'locality-seoul', label: 'Seoul' });
    expect(resolveVisualPlace('locality-seoul')).toMatchObject({ latitude: 37.566, longitude: 126.978 });
    expect(resolveCommonVisualLocality([ewhaPlace, ewhaPlace])).toBeNull();
    expect(resolveCommonVisualLocality([ewhaPlace, palace, taipei])).toBeNull();
  });

  it('recognizes exact Hanoi civic signage and reconciles only compatible place clues', () => {
    const hanoi = matchVisualSignage(['ỦY BAN NHÂN DÂN THÀNH PHỐ HÀ NỘI']);
    expect(hanoi).toMatchObject({ label: 'Hà Nội' });
    expect(typeof hanoi === 'object' && hanoi && canonicalVisualStop(hanoi.id)).toBe('locality-hanoi');
    expect(matchVisualSignage(['Hà Nội'])).toBeNull();
    expect(matchVisualSignage(['Welcome to Hà Nội'])).toBeNull();
    expect(matchVisualSignage(['ỦY BAN NHÂN DÂN THÀNH PHỐ HÀ NỘI', 'Áp phích'])).toBe('ambiguous');
    expect(matchVisualSignage(['ỦY BAN NHÂN DÂN THÀNH PHỐ HÀ NỘI', '서울특별시'])).toBe('ambiguous');
    expect(compatibleVisualPhotoClues('locality-hanoi', 'khue-van-cac')).toBe('khue-van-cac');
    expect(compatibleVisualPhotoClues('turtle-tower', 'locality-hanoi')).toBe('turtle-tower');
    expect(compatibleVisualPhotoClues('locality-hanoi', 'namsan-seoul-tower')).toBeNull();
  });

  it.each(['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc',
    'QUYẾT ĐỊNH', 'Thông báo về việc tổ chức', 'Số: 123/QĐ-UBND', 'Kính gửi: Các đơn vị liên quan',
  ])('abstains when Hanoi civic text occurs in administrative context %s', (document) => {
    expect(matchVisualSignage([`ỦY BAN NHÂN DÂN THÀNH PHỐ HÀ NỘI\n${document}`])).toBe('ambiguous');
  });

  it('restores the image evidence clue for a saved proposal', () => {
    expect(resolveVisualPlace(ewhaCampusComplex.id)).toEqual(ewhaCampusComplex);
    expect(ewhaCampusComplex.clue).toMatch(/architecture/i);
  });
});
