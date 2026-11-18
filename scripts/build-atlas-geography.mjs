import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , sourceDirectory] = process.argv;
if (!sourceDirectory) throw new Error('Pass a directory containing the unpacked GeoNames and geoBoundaries sources.');
const source = (file) => readFileSync(join(sourceDirectory, file), 'utf8');
const rows = (file) => source(file).trim().split(/\r?\n/).filter((line) => line && !line.startsWith('#')).map((line) => line.split('\t'));
const digest = (file) => createHash('sha256').update(source(file)).digest('hex');
const gazetteerDigests = {
  'VN.txt': '06c8674f73dbdfedab237f9c4538b10c89a72a061778b5d8110af579a7d9d670',
  'cities15000.txt': '9bbbfaefcf6ccbe1299c0c1ad188405537a535ee28ebecc2374e97a002a8fb1f',
  'admin1CodesASCII.txt': '2e4867f5397acb056ea26377601b57af37cb4c81399770225018e9e439e91ad3',
  'countryInfo.txt': '79f8f59ea01cbb40438bf1856dd6c2ff201f03f8fc72d0530b2646aaf603ef04',
};
const boundariesDigest = '2dff75b58e71f736ca9fd6ef7c859be40c6f9a9b7ae5cd0806b36fe8cfa4c4f6';
for (const [file, hash] of Object.entries({ ...gazetteerDigests, 'vietnam-adm2.geojson': boundariesDigest })) {
  if (digest(file) !== hash) throw new Error(`Unexpected public source version: ${file}`);
}
const countries = new Map(rows('countryInfo.txt').map((row) => [row[0], row[4]]));
const regions = new Map(rows('admin1CodesASCII.txt').map((row) => [row[0], row[1]]));
const vietnam = rows('VN.txt');
const districts = new Map(vietnam.filter((row) => row[7] === 'ADM2').map((row) => [`${row[10]}.${row[11]}`, row[1]]));
const vietnamNameOverrides = new Map([['1568212', 'Sa Đéc'], ['13494360', 'Đồng Tháp']]);
const vietnamPlaces = vietnam.filter((row) => /^(ADM[123]|PPLC|PPLA[2-4]?)$/.test(row[7]));
const worldwideCities = rows('cities15000.txt').filter((row) => row[8] !== 'VN' && /^PPL(?:A[2-4]?|C)?$/.test(row[7]));

const gazetteer = [...vietnamPlaces, ...worldwideCities].flatMap((row) => {
  const [id, sourceName, , , latitudeText, longitudeText, , type, code, , province, district] = row;
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!id || !sourceName || !latitudeText || !longitudeText || !countries.has(code)
    || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || (!latitude && !longitude)) return [];
  const level = type === 'ADM1' ? 'Province' : type === 'ADM2' ? 'District'
    : type === 'ADM3' ? (/^(Phường|Ward)\b|\bWard$/iu.test(sourceName) ? 'Ward' : 'Commune / ward') : 'City / town';
  const provinceName = type === 'ADM1' ? null : regions.get(`${code}.${province}`);
  const districtName = type === 'ADM3' ? districts.get(`${province}.${district}`) : null;
  const context = [districtName, provinceName, countries.get(code)].filter(Boolean).join(', ');
  return [[id, vietnamNameOverrides.get(id) ?? sourceName, context, level, latitude, longitude]];
}).sort((left, right) => Number(left[0]) - Number(right[0]));
if (gazetteer.length < 30000 || new Set(gazetteer.map(([id]) => id)).size !== gazetteer.length
  || !gazetteer.some(([id]) => id === '1568212') || !gazetteer.some(([id]) => id === '1586203')) {
  throw new Error('GeoNames locality asset failed coverage or uniqueness validation.');
}

const cityFootprints = new Map([
  ['Sa Dec', 'Sa Đéc'], ['Ninh Kieu', 'Cần Thơ'], ['Binh Thuy', 'Cần Thơ'],
  ['Cai Rang', 'Cần Thơ'], ['O Mon', 'Cần Thơ'], ['Thot Not', 'Cần Thơ'],
  ['Hue', 'Huế'], ['Hoi An', 'Hội An'], ['Da Lat', 'Đà Lạt'],
  ['Nha Trang', 'Nha Trang'], ['Quy Nhon', 'Quy Nhơn'], ['Vinh', 'Vinh'],
  ['Vung Tau', 'Vũng Tàu'], ['Phu Quoc', 'Phú Quốc'], ['Ha Long', 'Hạ Long'],
]);
for (const [name, districts] of [
  ['Hà Nội', ['Ba Dinh', 'Cau Giay', 'Dong Da', 'Hai Ba Trung', 'Hoan Kiem', 'Long Bien', 'Tay Ho', 'Thanh Xuan']],
  ['Đà Nẵng', ['Cam Le', 'Hai Chau', 'Lien Chieu', 'Ngu Hanh Son', 'Son Tra', 'Thanh Khe']],
  ['TP. Hồ Chí Minh', ['Binh Thanh', 'Go Vap', 'Phu Nhuan', 'Quan 1', 'Quan 3', 'Quan 4', 'Quan 5', 'Quan 6',
    'Quan 7', 'Quan 8', 'Quan 10', 'Quan 11', 'Tan Binh']],
]) {
  for (const district of districts) cityFootprints.set(district, name);
}
const boundaries = JSON.parse(source('vietnam-adm2.geojson'));
const selected = boundaries.features.filter((feature) => cityFootprints.has(feature.properties.shapeName));
if (selected.length !== cityFootprints.size || new Set(selected.map(({ properties }) => properties.shapeName)).size !== cityFootprints.size) {
  throw new Error('Expected unique Vietnam locality footprints.');
}
const footprints = selected.map(({ properties, geometry }) => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const rings = [];
  const bounds = [];
  for (const polygon of polygons) for (const ring of polygon) {
    let previousX = 0;
    let previousY = 0;
    const xs = [];
    const ys = [];
    const deltas = [];
    for (const [longitude, latitude] of ring) {
      if (!Number.isFinite(longitude) || Math.abs(longitude) > 180 || !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
        throw new Error('Invalid public locality coordinate.');
      }
      const x = Math.round(longitude * 10000);
      const y = Math.round(latitude * 10000);
      xs.push(x); ys.push(y);
      deltas.push((x - previousX).toString(36), (y - previousY).toString(36));
      previousX = x; previousY = y;
    }
    rings.push(deltas.join(','));
    bounds.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((coordinate) => coordinate / 10000));
  }
  return { code: 'VNM', name: cityFootprints.get(properties.shapeName), shapeId: properties.shapeID, rings, bounds };
});

const output = new URL('../apps/mobile/src/reconstruction/data/', import.meta.url);
const write = (file, value) => writeFileSync(new URL(file, output), JSON.stringify(value) + '\n');
write('home-gazetteer-geonames.json', {
  version: 'geonames-home-2026-11-11', sourceDigests: gazetteerDigests,
  credit: { title: 'GeoNames', source: 'https://www.geonames.org/export/', license: 'https://creativecommons.org/licenses/by/4.0/' },
  places: gazetteer,
});
write('vietnam-localities-81297802.json', {
  version: 'geoboundaries-VNM-ADM2-81297802-urban-v2', sourceDigest: boundariesDigest,
  credit: { title: 'OCHA ROAP and Government of Viet Nam via geoBoundaries', source: 'https://www.geoboundaries.org/api/current/gbOpen/VNM/ADM2/', license: 'https://creativecommons.org/licenses/by/3.0/igo/' },
  places: footprints,
});
