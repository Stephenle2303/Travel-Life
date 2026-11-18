import type { VisualPlace } from './recovery';

export const visualRecognizerPolicyVersion = 'local-signage-embedding-v3';

type CatalogPlace = {
  place: VisualPlace;
  latitude: number;
  longitude: number;
  names: readonly string[];
};

export const ewhaPlace: VisualPlace = {
  id: 'ewha-womans-university',
  label: 'Ewha Womans University',
  locality: 'Seoul, South Korea',
  clue: 'The university’s name appears in the photo.',
};

export const ewhaCampusComplex: VisualPlace & { latitude: number; longitude: number } = {
  id: 'ewha-campus-complex-visual',
  label: 'Ewha Campus Complex',
  locality: ewhaPlace.locality,
  clue: 'Architecture in the photo matches the Ewha Campus Complex.',
  latitude: 37.56,
  longitude: 126.94,
};

export const ewhaCampusVisual: typeof ewhaCampusComplex = {
  ...ewhaCampusComplex,
  id: 'ewha-campus-visual',
  label: ewhaPlace.label,
  clue: 'Architecture in the photo matches a public reference of the university campus.',
};

const seoul = {
  id: 'locality-seoul',
  label: 'Seoul',
  locality: 'South Korea',
  clue: 'Recognized photo evidence points to Seoul.',
  latitude: 37.566,
  longitude: 126.978,
};

const seoulSignage = {
  ...seoul,
  id: 'seoul-municipal-signage',
  clue: 'The name of the Seoul city government appears in the photo.',
};

const hanoi = {
  id: 'locality-hanoi', label: 'Hà Nội', locality: 'Việt Nam',
  clue: 'Recognized photo evidence points to Hà Nội.', latitude: 21.028, longitude: 105.852,
};

const catalogueLocalities = new Map([['Seoul, South Korea', seoul], ['Hà Nội, Việt Nam', hanoi]]);
const regionalLandmarkPlaces: Readonly<Record<string, { id: string; country: string }>> = {
  ewha: { id: ewhaPlace.id, country: 'KR' },
  namsan: { id: 'namsan-seoul-tower', country: 'KR' },
  nami: { id: 'nami-island', country: 'KR' },
  'turtle-tower': { id: 'turtle-tower', country: 'VN' },
  'khue-van-cac': { id: 'khue-van-cac', country: 'VN' },
};

const regionalVisualPlaces = [
  { id: 'turtle-tower', label: 'Tháp Rùa', latitude: 21.02790, longitude: 105.85230 },
  { id: 'khue-van-cac', label: 'Khuê Văn Các', latitude: 21.02908, longitude: 105.83573 },
].map((place) => ({ ...place, locality: 'Hà Nội, Việt Nam', clue: 'Architecture in the photo matches a public reference of the landmark.' }));

export function resolveRegionalLandmarkId(id: string) {
  return Object.hasOwn(regionalLandmarkPlaces, id) ? regionalLandmarkPlaces[id] : null;
}

export function visualPlaceCountry(id: string) {
  const place = resolveVisualPlace(id);
  if (!place) return null;
  if (place.locality.endsWith('South Korea')) return 'KR';
  if (place.locality.endsWith('Việt Nam')) return 'VN';
  if (place.locality.endsWith('Taiwan')) return 'TW';
  if (place.locality.endsWith('Japan')) return 'JP';
  return null;
}

export function resolveVisualLocality(locality: string): VisualPlace | null {
  const place = catalogueLocalities.get(locality);
  if (!place) return null;
  const { id, label, clue } = place;
  return { id, label, locality: place.locality, clue };
}

// Rounded public map anchors. A match identifies visible signage, not EXIF
// or the capture location of this or any neighboring photograph.
const signageCatalog: readonly CatalogPlace[] = [
  {
    place: seoulSignage,
    latitude: seoul.latitude,
    longitude: seoul.longitude,
    names: ['seoul metropolitan government', '서울특별시', '서울시청'],
  },
  {
    place: { ...hanoi, clue: 'The name of the Hà Nội city government appears in the photo.' },
    latitude: hanoi.latitude,
    longitude: hanoi.longitude,
    names: ['ủy ban nhân dân thành phố hà nội', 'uỷ ban nhân dân thành phố hà nội'],
  },
  {
    place: ewhaPlace,
    latitude: 37.56,
    longitude: 126.94,
    names: ['ewha womans university', 'ewha woman s university', '이화여자대학교'],
  },
  {
    place: {
      id: 'namsan-seoul-tower', label: 'N Seoul Tower', locality: 'Seoul, South Korea',
      clue: 'Signage or architecture in the photo points to N Seoul Tower.',
    },
    latitude: 37.551216,
    longitude: 126.988276,
    names: ['n seoul tower', 'namsan seoul tower', '남산서울타워', '남산타워'],
  },
  {
    place: {
      id: 'nami-island', label: 'Nami Island', locality: 'Chuncheon, South Korea',
      clue: 'The island’s name appears in the photo.',
    },
    latitude: 37.791667,
    longitude: 127.525556,
    names: ['nami island', 'namiseom', '남이섬'],
  },
  {
    place: {
      id: 'gyeongbokgung-palace',
      label: 'Gyeongbokgung Palace',
      locality: 'Seoul, South Korea',
      clue: 'The palace’s name appears in the photo.',
    },
    latitude: 37.58,
    longitude: 126.98,
    names: ['gyeongbokgung palace', '경복궁'],
  },
  {
    place: {
      id: 'taipei-101',
      label: 'Taipei 101',
      locality: 'Taipei, Taiwan',
      clue: 'The landmark’s name appears in the photo.',
    },
    latitude: 25.034,
    longitude: 121.565,
    names: ['taipei 101', '台北101', '臺北101'],
  },
  {
    place: {
      id: 'tokyo-skytree',
      label: 'Tokyo Skytree',
      locality: 'Tokyo, Japan',
      clue: 'The tower’s name appears in the photo.',
    },
    latitude: 35.71,
    longitude: 139.811,
    names: ['tokyo skytree', '東京スカイツリー'],
  },
];

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function resolveVisualPlace(id: string): (VisualPlace & { latitude: number; longitude: number }) | null {
  if (id === seoul.id) return seoul;
  if (id === hanoi.id) return hanoi;
  if (id === ewhaCampusComplex.id) return ewhaCampusComplex;
  if (id === ewhaCampusVisual.id) return ewhaCampusVisual;
  const regional = regionalVisualPlaces.find((place) => place.id === id);
  if (regional) return regional;
  const match = signageCatalog.find((item) => item.place.id === id);
  return match ? { ...match.place, latitude: match.latitude, longitude: match.longitude } : null;
}

export function resolveCommonVisualLocality(places: readonly VisualPlace[]): VisualPlace | null {
  if (new Set(places.map((place) => place.id)).size < 2
    || places.some((place) => place.id !== seoulSignage.id && place.id !== seoul.id && place.locality !== 'Seoul, South Korea')) return null;
  const { id, label, locality, clue } = seoul;
  return { id, label, locality, clue };
}

export function canonicalVisualStop(id: string) {
  return id === ewhaCampusComplex.id || id === ewhaCampusVisual.id ? ewhaPlace.id
    : id === seoulSignage.id ? seoul.id : id;
}

export function isVisualLocality(id: string) {
  const canonicalId = canonicalVisualStop(id);
  return canonicalId === seoul.id || canonicalId === hanoi.id;
}

export function visualLocalityId(id: string) {
  if (isVisualLocality(id)) return canonicalVisualStop(id);
  const place = resolveVisualPlace(id);
  return place ? resolveVisualLocality(place.locality)?.id : undefined;
}

export function compatibleVisualPhotoClues(left: string, right: string) {
  const leftId = canonicalVisualStop(left);
  const rightId = canonicalVisualStop(right);
  if (leftId === rightId) return leftId;
  if (isVisualLocality(leftId) && visualLocalityId(rightId) === leftId) return rightId;
  if (isVisualLocality(rightId) && visualLocalityId(leftId) === rightId) return leftId;
  return null;
}

export function matchVisualSignage(blocks: readonly string[]): VisualPlace | 'ambiguous' | null {
  const lines = new Set(blocks.flatMap((block) => block.split(/\r?\n/)).map((text) => {
    const line = normalize(text);
    return /[\p{Script=Hangul}\p{Script=Han}\p{Script=Katakana}]/u.test(line) ? line.replace(/ /g, '') : line;
  }));
  const matching = signageCatalog.filter(({ names }) => names.some((name) => lines.has(name)));
  if (!matching.length) return null;
  const context = normalize(blocks.join(' '));
  const documentOrTransit = /\b(?:hospital|medical center|magok|mokdong|map|poster|brochure|admissions|subway|station|boarding pass|departures|arrivals|ticket|directions)\b/u;
  const localDocumentOrTransit = /병원|의료원|마곡|목동|지도|모집\s*요강|이화여대역|경복궁역|東京スカイツリー駅|捷運|導覽/u;
  const vietnameseDocumentOrTransit = /(?:^| )(?:áp phích|bản đồ|tờ rơi|vé tàu|ga tàu|tài liệu|quảng cáo)(?: |$)/u;
  if (documentOrTransit.test(context) || localDocumentOrTransit.test(context) || vietnameseDocumentOrTransit.test(context)) return 'ambiguous';
  const administrativeHeading = /^(?:quyết định|thông báo|công văn|nghị quyết|tờ trình)(?: |$)/u;
  const administrativeReference = /(?:^| )(?:cộng (?:hòa|hoà) xã hội chủ nghĩa việt nam|độc lập tự do hạnh phúc|kính gửi|nơi nhận|số \d+ (?:qđ|tb|nq|ttr|ubnd))(?: |$)/u;
  if (matching.some(({ place }) => place.id === hanoi.id)
    && (administrativeReference.test(context) || [...lines].some((line) => administrativeHeading.test(line)))) return 'ambiguous';
  if (matching.length === 1) return matching[0].place;
  const [first, second] = matching;
  const compatible = matching.length === 2 && compatibleVisualPhotoClues(first.place.id, second.place.id);
  return compatible ? matching.find(({ place }) => place.id === compatible)!.place : 'ambiguous';
}
