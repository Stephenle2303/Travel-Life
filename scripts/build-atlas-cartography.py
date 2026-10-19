"""Generate offline Winkel Tripel cartography from public Natural Earth sources.

uv run --with pillow --with numpy --with pyshp scripts/build-atlas-cartography.py
Inputs live in ignored .tools/atlas-cartography; no reference screenshot is read.
"""
from pathlib import Path
import hashlib
import io
import json
import math
import zipfile
import numpy as np
import shapefile
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / '.tools/atlas-cartography'
WIDTH, HEIGHT = 2048, 1280
SCALE = WIDTH * .94 / (math.pi + 2)

def raw(lon, lat):
    alpha = np.arccos(np.clip(np.cos(lat) * np.cos(lon / 2), -1, 1))
    sinc = np.sinc(alpha / math.pi)
    return (lon * (2 / math.pi) + 2 * np.cos(lat) * np.sin(lon / 2) / sinc) / 2, (lat + np.sin(lat) / sinc) / 2

def project(lon, lat):
    x, y = raw(np.radians(lon), np.radians(lat))
    return WIDTH / 2 + x * SCALE, HEIGHT / 2 - y * SCALE * 1.6

archive = INPUT / 'NE2_50M_SR.zip'
with zipfile.ZipFile(archive) as z:
    name = next(n for n in z.namelist() if n.lower().endswith('.tif'))
    relief = np.asarray(Image.open(io.BytesIO(z.read(name))).convert('RGB').resize((3600, 1800)))

vector = INPUT / 'ne_50m_admin_0_countries.zip'
with zipfile.ZipFile(vector) as z:
    stem = next(n[:-4] for n in z.namelist() if n.endswith('.shp'))
    reader = shapefile.Reader(shp=io.BytesIO(z.read(stem + '.shp')), shx=io.BytesIO(z.read(stem + '.shx')), dbf=io.BytesIO(z.read(stem + '.dbf')))
    rings = []
    for shape in reader.shapes():
        cuts = list(shape.parts) + [len(shape.points)]
        rings.extend([shape.points[a:b] for a, b in zip(cuts[:-1], cuts[1:])])

mask = Image.new('L', (3600, 1800))
draw = ImageDraw.Draw(mask)
for ring in rings:
    draw.polygon([((lon + 180) * 10, (90 - lat) * 10) for lon, lat in ring], fill=255)

# Inverse the same projection numerically. Clip only the actual projected world.
yy, xx = np.mgrid[0:HEIGHT, 0:WIDTH]
target_x, target_y = (xx - WIDTH / 2) / SCALE, -(yy - HEIGHT / 2) / (SCALE * 1.6)
lon = np.clip(target_x / .82, -math.pi, math.pi)
lat = np.clip(target_y, -math.pi / 2, math.pi / 2)
for _ in range(14):
    x, y = raw(lon, lat)
    x1, y1 = raw(lon + 1e-5, lat)
    x2, y2 = raw(lon, lat + 1e-5)
    a, b, c, d = (x1-x)/1e-5, (x2-x)/1e-5, (y1-y)/1e-5, (y2-y)/1e-5
    det = a*d-b*c
    det = np.where(np.abs(det) < 1e-8, 1e-8, det)
    dx, dy = x-target_x, y-target_y
    lon = np.clip(lon-(d*dx-b*dy)/det, -math.pi, math.pi)
    lat = np.clip(lat-(-c*dx+a*dy)/det, -math.pi/2, math.pi/2)
x, y = raw(lon, lat)
inside = (np.abs(x-target_x) < .005) & (np.abs(y-target_y) < .005)
sx = np.clip(((np.degrees(lon)+180)*10).astype(int), 0, 3599)
sy = np.clip(((90-np.degrees(lat))*10).astype(int), 0, 1799)
land = (np.asarray(mask)[sy, sx] > 0) & inside
texture = relief[sy, sx].astype(float)
light = (texture[...,0]*.25 + texture[...,1]*.6 + texture[...,2]*.15) / 255
ocean = np.zeros((HEIGHT, WIDTH, 3), dtype=float)
glow = np.exp(-(((xx/WIDTH-.53)/.6)**2+((yy/HEIGHT-.36)/.65)**2))
for channel, (base, gain) in enumerate([(5, 5), (17, 16), (31, 23)]):
    ocean[...,channel] = base + gain*glow
colors = ocean.copy()
for channel, (base, gain) in enumerate([(20, 39), (49, 62), (65, 67)]):
    colors[...,channel] = np.where(land, base+gain*light, colors[...,channel])
image = Image.fromarray(np.uint8(np.clip(colors, 0, 255)))
coast = Image.fromarray(np.uint8(land)*255)
halo = np.asarray(coast.filter(ImageFilter.GaussianBlur(5))).astype(float)/255 * (~land)
arr = np.asarray(image).astype(float)
arr += halo[...,None]*np.array([8, 21, 26])
image = Image.fromarray(np.uint8(np.clip(arr, 0, 255)))
# Political boundaries and geographic names intentionally do not enter the relief
# raster. They are independent public overlays at runtime, so their width/text
# remains readable when the camera zooms and tile LOD changes.
manifest = {'version':'atlas-ne-winkel-relief-2','projection':'Winkel Tripel','width':WIDTH,'height':HEIGHT,'scale':SCALE,'sources':[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [archive,vector]],'license':'Natural Earth public domain','sourceUrl':'https://www.naturalearthdata.com/about/terms-of-use/','layers':['relief','coastal-glow']}
for app in ['mobile','prototype']:
    target = ROOT / f'apps/{app}/assets/atlas'
    target.mkdir(parents=True, exist_ok=True)
    image.save(target/'world-base.png', optimize=True)
    image.resize((1024,640),Image.Resampling.LANCZOS).save(target/'world-base-low.png', optimize=True)
    (target/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'bytes':(target/'world-base.png').stat().st_size,'sha256':hashlib.sha256((target/'world-base.png').read_bytes()).hexdigest()}))
