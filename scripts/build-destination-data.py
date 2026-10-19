"""Build offline Natural Earth 5.1.1 country and region lookup assets.

Run with uv run --with pyshp --with shapely scripts/build-destination-data.py ADMIN0.zip ADMIN1.zip.
Source archives are public data; no device evidence is read by this script.
"""
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile

import shapefile
from shapely.geometry import shape


def read_archive(path):
    with zipfile.ZipFile(path) as archive:
        stem = next(name[:-4] for name in archive.namelist() if name.endswith('.shp'))
        reader = shapefile.Reader(shp=io.BytesIO(archive.read(stem + '.shp')),
                                  shx=io.BytesIO(archive.read(stem + '.shx')),
                                  dbf=io.BytesIO(archive.read(stem + '.dbf')))
        for item in reader.iterShapeRecords():
            record = item.record.as_dict()
            geometry = shape(item.shape.__geo_interface__).simplify(0.001, preserve_topology=True)
            polygons = [geometry] if geometry.geom_type == 'Polygon' else geometry.geoms
            rings = [[[round(x, 4), round(y, 4)] for x, y in ring.coords]
                     for polygon in polygons for ring in [polygon.exterior, *polygon.interiors]]
            yield record, rings


root = Path(__file__).resolve().parents[1] / 'apps/mobile/src/reconstruction/data'


def base36(value):
    sign = '-' if value < 0 else ''
    value = abs(value)
    digits = ''
    while value:
        value, digit = divmod(value, 36)
        digits = '0123456789abcdefghijklmnopqrstuvwxyz'[digit] + digits
    return sign + (digits or '0')


def packed_area(code, name, rings):
    packed = []
    bounds = []
    for ring in rings:
        values = []
        previous_x = previous_y = 0
        for x, y in ring:
            current_x, current_y = round(x * 10000), round(y * 10000)
            values.extend([base36(current_x - previous_x), base36(current_y - previous_y)])
            previous_x, previous_y = current_x, current_y
        packed.append(','.join(values))
        bounds.append([min(p[0] for p in ring), min(p[1] for p in ring),
                       max(p[0] for p in ring), max(p[1] for p in ring)])
    return {'code': code, 'name': name, 'rings': packed, 'bounds': bounds}


countries = []
for record, rings in read_archive(sys.argv[1]):
    code = record['ADM0_A3']
    countries.append(packed_area(code, record['NAME_EN'], rings))
regions = []
for record, rings in read_archive(sys.argv[2]):
    name = record.get('name_en') or record.get('name')
    if name and record.get('adm0_a3'):
        regions.append(packed_area(record['adm0_a3'], name, rings))
payload = {'version': '5.1.1-10m-0.001deg-4dp', 'sources': [hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in sys.argv[1:3]],
           'countries': countries, 'regions': regions}
target = root / 'natural-earth-destinations-5.1.1.json'
target.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'countries': len(countries), 'regions': len(regions), 'bytes': target.stat().st_size}))
