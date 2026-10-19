"""Build a registered offline resolution pyramid; never upscale world-base.png.

uv run --with pillow==13.0.0 --with numpy==2.5.4 --with pyshp==3.1.6 scripts/build-atlas-tiles.py
Uses original Natural Earth relief and country geometry pinned in atlas/manifest.json.
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
OUTPUT = ROOT / 'apps/mobile/assets/atlas/tiles'
OUTPUT.mkdir(parents=True, exist_ok=True)
for stale in OUTPUT.glob('*.webp'):
    stale.unlink()
TILE = 512
LEVELS = [4096, 8192, 16384]
SCALE = .94 / (math.pi + 2)

def raw(lon, lat):
    alpha = np.arccos(np.clip(np.cos(lat) * np.cos(lon/2), -1, 1))
    sinc = np.sinc(alpha/math.pi)
    return (lon*2/math.pi+2*np.cos(lat)*np.sin(lon/2)/sinc)/2, (lat+np.sin(lat)/sinc)/2

def inverse(x, y):
    lon = np.clip(x/.82, -math.pi, math.pi)
    lat = np.clip(y, -math.pi/2, math.pi/2)
    for _ in range(14):
        px, py = raw(lon, lat)
        a1, c1 = raw(lon+1e-5, lat)
        b1, d1 = raw(lon, lat+1e-5)
        a,b,c,d = (a1-px)/1e-5,(b1-px)/1e-5,(c1-py)/1e-5,(d1-py)/1e-5
        det = a*d-b*c
        det = np.where(np.abs(det)<1e-8,1e-8,det)
        dx,dy = px-x,py-y
        lon = np.clip(lon-(d*dx-b*dy)/det,-math.pi,math.pi)
        lat = np.clip(lat-(-c*dx+a*dy)/det,-math.pi/2,math.pi/2)
    return lon,lat

archive = INPUT/'NE2_50M_SR.zip'
with zipfile.ZipFile(archive) as z:
    name=next(n for n in z.namelist() if n.lower().endswith('.tif'))
    relief=Image.open(io.BytesIO(z.read(name))).convert('RGB')
    relief.load()
print(json.dumps({'sourceSize':relief.size}),flush=True)
with zipfile.ZipFile(INPUT/'ne_50m_admin_0_countries.zip') as z:
    stem=next(n[:-4] for n in z.namelist() if n.endswith('.shp'))
    reader=shapefile.Reader(shp=io.BytesIO(z.read(stem+'.shp')),shx=io.BytesIO(z.read(stem+'.shx')),dbf=io.BytesIO(z.read(stem+'.dbf')))
    rings=[]
    for shape in reader.shapes():
        cuts=list(shape.parts)+[len(shape.points)]
        for a,b in zip(cuts[:-1],cuts[1:]):
            geographic=np.asarray(shape.points[a:b])
            px,py=raw(np.radians(geographic[:,0]),np.radians(geographic[:,1]))
            points=np.column_stack((.5+px*SCALE,.5-py*SCALE*1.6))
            bounds=(points[:,0].min(),points[:,1].min(),points[:,0].max(),points[:,1].max())
            area=np.sum(geographic[:-1,0]*geographic[1:,1]-geographic[1:,0]*geographic[:-1,1])
            rings.append((points,bounds,area>0))

registry=[]
manifest={'tileSize':TILE,'levels':LEVELS,'projection':'atlas-ne-winkel-1','sourceSize':relief.size,'files':{}}
for width in LEVELS:
    height=width*5//8
    entries=[]
    # Mesh corners inverse-projected through exactly the same world transform.
    # 16px cells bound curvature error without a pixel-by-pixel iterative inverse.
    for row in range(math.ceil(height/TILE)):
        for col in range(math.ceil(width/TILE)):
            left,top=col*TILE,row*TILE
            tw,th=min(TILE,width-left),min(TILE,height-top)
            border=4
            xs=np.arange(-border,tw+border+1,16,dtype=float)
            ys=np.arange(-border,th+border+1,16,dtype=float)
            if xs[-1]!=tw+border: xs=np.append(xs,tw+border)
            if ys[-1]!=th+border: ys=np.append(ys,th+border)
            gx,gy=np.meshgrid(xs+left,ys+top)
            lon,lat=inverse((gx/width-.5)/SCALE,(.5-gy/height)/(SCALE*1.6))
            sx=(np.degrees(lon)+180)/360*relief.width
            sy=(90-np.degrees(lat))/180*relief.height
            mesh=[]
            for j in range(len(ys)-1):
                for i in range(len(xs)-1):
                    box=tuple(int(v) for v in (xs[i]+border,ys[j]+border,xs[i+1]+border,ys[j+1]+border))
                    quad=(sx[j,i],sy[j,i],sx[j+1,i],sy[j+1,i],sx[j+1,i+1],sy[j+1,i+1],sx[j,i+1],sy[j,i+1])
                    mesh.append((box,quad))
            texture=np.asarray(relief.transform((tw+border*2,th+border*2),Image.Transform.MESH,mesh,Image.Resampling.BILINEAR)).astype(float)
            mask=Image.new('L',(tw+border*2,th+border*2))
            draw=ImageDraw.Draw(mask)
            for points,bounds,hole in rings:
                x0,y0,x1,y1=bounds
                if x1*width<left-border or x0*width>left+tw+border or y1*height<top-border or y0*height>top+th+border: continue
                local=[(float(x*width-left+border),float(y*height-top+border)) for x,y in points]
                draw.polygon(local,fill=0 if hole else 255)
            land=np.asarray(mask)>0
            yy,xx=np.mgrid[top-border:top+th+border,left-border:left+tw+border]
            glow=np.exp(-(((xx/width-.53)/.6)**2+((yy/height-.36)/.65)**2))
            light=(texture[...,0]*.25+texture[...,1]*.6+texture[...,2]*.15)/255
            colors=np.empty_like(texture)
            for channel,(base,gain,land_base,land_gain) in enumerate([(5,5,20,39),(17,16,49,62),(31,23,65,67)]):
                colors[...,channel]=np.where(land,land_base+land_gain*light,base+gain*glow)
            halo=np.asarray(mask.filter(ImageFilter.GaussianBlur(3))).astype(float)/255*(~land)
            colors+=halo[...,None]*np.array([8,21,26])
            image=Image.fromarray(np.uint8(np.clip(colors,0,255)))
            image=image.crop((border,border,tw+border,th+border))
            filename=f'{width}-{col}-{row}.webp'
            path=OUTPUT/filename
            image.save(path,'WEBP',quality=88,method=4)
            manifest['files'][filename]=hashlib.sha256(path.read_bytes()).hexdigest()
            entries.append(f"    '{col}:{row}': require('../../assets/atlas/tiles/{filename}'),")
    registry.append('  '+str(width)+': {\n'+'\n'.join(entries)+'\n  },')
    print(json.dumps({'width':width,'tiles':len(entries)}),flush=True)

ts="// Generated by scripts/build-atlas-tiles.py. Explicit local requires for Metro.\nexport const ATLAS_TILES: Record<number, Record<string, number>> = {\n"+'\n'.join(registry)+'\n};\n'
(ROOT/'apps/mobile/src/atlas/tile-assets.ts').write_text(ts,encoding='utf-8')
(OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'totalBytes':sum(p.stat().st_size for p in OUTPUT.glob('*.webp'))}),flush=True)
