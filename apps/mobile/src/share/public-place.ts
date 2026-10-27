import dataset from '@/reconstruction/data/natural-earth-destinations-5.1.1.json';

/** Public gazetteer geometry only. Never publish a photo/cluster coordinate. */
export function namedPlaceCentroid(label: string): { country: string; centroid: { latitude: number; longitude: number } | null } {
  const countries = dataset.countries;
  const country = countries.find(item => label === item.name || label.endsWith(', ' + item.name));
  const regionName = country && label.endsWith(', ' + country.name) ? label.slice(0, -country.name.length - 2) : null;
  const area = regionName ? dataset.regions.find(item => item.code === country?.code && item.name === regionName) : country;
  if (!area) return { country: country?.name ?? '', centroid: null };
  let largest = 0; let centroid: { latitude: number; longitude: number } | null = null;
  for (const packed of area.rings) {
    const values = packed.split(','); const points: [number, number][] = []; let x = 0; let y = 0;
    for (let index = 0; index < values.length; index += 2) { x += parseInt(values[index], 36); y += parseInt(values[index + 1], 36); points.push([x / 10000, y / 10000]); }
    if (points.some((point, index) => index > 0 && Math.abs(point[0] - points[index - 1][0]) > 180)) continue;
    let areaSum = 0; let lon = 0; let lat = 0;
    for (let index = 0; index < points.length; index++) { const a = points[index]; const b = points[(index + 1) % points.length]; const cross = a[0] * b[1] - b[0] * a[1]; areaSum += cross; lon += (a[0] + b[0]) * cross; lat += (a[1] + b[1]) * cross; }
    if (Math.abs(areaSum) > largest) { largest = Math.abs(areaSum); centroid = { longitude: Math.round(lon / (3 * areaSum) * 1000) / 1000, latitude: Math.round(lat / (3 * areaSum) * 1000) / 1000 }; }
  }
  return { country: country?.name ?? '', centroid };
}
