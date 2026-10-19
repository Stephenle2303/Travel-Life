"""Validate shipped tiles and write a public Vietnam resolution comparison."""
from pathlib import Path
import hashlib
import json
import re
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
tiles=ROOT/'apps/mobile/assets/atlas/tiles'
manifest=json.loads((tiles/'manifest.json').read_text())
registry=(ROOT/'apps/mobile/src/atlas/tile-assets.ts').read_text()
assert len(manifest['files'])==840
assert len(re.findall(r'require\(',registry))==840
for filename,digest in manifest['files'].items():
    path=tiles/filename
    assert hashlib.sha256(path.read_bytes()).hexdigest()==digest,filename
    with Image.open(path) as image:
        assert image.size==(512,512),filename
        image.verify()
# Same public geographic extent from the former base and from newly rendered relief detail.
col,row,level=24,8,16384
base=Image.open(ROOT/'apps/mobile/assets/atlas/world-base.png')
old=base.crop((col*64,row*64,(col+1)*64,(row+1)*64)).resize((512,512),Image.Resampling.BILINEAR)
detail=Image.open(tiles/f'{level}-{col}-{row}.webp').convert('RGB')
compare=Image.new('RGB',(1024,550),'#0B132B')
compare.paste(old,(0,38))
compare.paste(detail,(512,38))
draw=ImageDraw.Draw(compare)
draw.text((12,12),'Previous: enlarged 2048px world base',fill='white')
draw.text((524,12),'Now: original relief detail (vector borders are runtime overlays)',fill='white')
out=ROOT/'.tools/atlas-cartography/vietnam-resolution-comparison.png'
compare.save(out)
print(json.dumps({'validTiles':840,'packagedBytes':sum((tiles/p).stat().st_size for p in manifest['files']),'comparison':str(out)}))
