# Offline Atlas cartography

`world-base.png` is generated from Natural Earth II shaded relief. It contains no
political boundaries or geographic labels, application controls, trip dots,
cards, or route claims. `src/atlas/country-boundaries.ts` is the separate bundled
Natural Earth 1:50m Admin0 vector overlay. The mobile map projects it and local
coarse journey points through `src/atlas/world-projection.ts`, using identical
Winkel Tripel output dimensions. The lower-resolution asset is the local decode
fallback. Current Vietnam Admin1 boundaries are deliberately unavailable until a
redistributable current 34-unit source passes its recorded verification gate.

Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/

Inputs (kept outside Git in `.tools/atlas-cartography`):

- https://naciscdn.org/naturalearth/50m/raster/NE2_50M_SR.zip
- https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip

`manifest.json` pins downloaded input SHA-256 hashes, image dimensions and projection scale. Generate from the repository root with `uv run --with pillow==13.0.0 --with numpy==2.5.4 --with pyshp==3.1.6 scripts/build-atlas-cartography.py`; generate the vector module with `uv run --with pyshp==3.1.6 scripts/build-atlas-boundaries.py`. The scripts output identical relief assets for mobile/prototype. The current browser prototype integration is separate from the native delivery.

This is a geographic replacement with the approved dark-blue/gold palette and real relief. It has not been accepted as an exact match to the reference's lighting/ocean detailing. Natural Earth boundaries describe its cartographic policy, not owner presence or adjudication of territorial claims.

## Detail pyramid

Generate with `uv run --with pillow==13.0.0 --with numpy==2.5.4 --with pyshp==3.1.6 scripts/build-atlas-tiles.py` from the repository root. The generator samples the original 10800x5400 relief TIFF, never the 2048px base. Levels 4096, 8192 and 16384 contain 840 bundled 512px WebP tiles. `tiles/manifest.json` pins each generated tile hash. `src/atlas/tile-assets.ts` contains explicit Metro asset requires. The 16px inverse mesh uses the same Winkel equation as overlays; tiles are relief-only, with a cropped gutter.

`visible-tiles.ts` chooses resolution from viewport scale and display density, caps the active set at 48 tiles and culls offscreen cells. Detail images disable cache accumulation. Tile decode failures leave the bundled base beneath them visible. Worst-case active tile pixels represent 48 MiB of RGBA data, plus the base and renderer overhead; actual native residency/frame time remains unmeasured. This is relief, not street mapping. At extreme zoom the original source detail still imposes a limit.

Run `uv run --with pillow==13.0.0 scripts/check-atlas-tiles.py` to validate all hashes/dimensions/registry count and generate an ignored public Vietnam comparison. The pyramid adds about 3.5 MiB to packaged assets, inside the proposed 12 MiB asset budget; it does not bundle the source TIFF.
