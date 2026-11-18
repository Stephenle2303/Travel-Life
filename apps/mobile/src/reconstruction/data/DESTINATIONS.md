# Offline destination data

`natural-earth-destinations-5.1.1.json` contains worldwide Natural Earth 5.1.1
10m Admin-0 countries and Admin-1 regions. It is public domain and contains no
owner records. Sources:

- https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/
- https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
- https://www.naturalearthdata.com/about/terms-of-use/

Reproduce with `uv run --with pyshp --with shapely scripts/build-destination-data.py
ADMIN0.zip ADMIN1.zip`. The source archives are `ne_10m_admin_0_countries.zip`
and `ne_10m_admin_1_states_provinces.zip` from naciscdn.org. The generated asset
records their SHA-256 digests, 258 countries, 4,589 named regions and its derived
version. Generation uses topology-preserving 0.001-degree simplification and
four decimal places. Rings use base-36 integer coordinate deltas; their bounds
are stored separately so only nearby rings need decoding. Output size is
11,197,388 bytes. The decoded-ring cache retains at most 50,000 points.
Node's forced-GC probe measured approximately 13 MB added heap for the packed
asset; this is not a physical-device memory measurement. No runtime package or
service dependency is added.

The resolver adds a 250 m geometry margin plus reported source accuracy (up to
1,000 m). Invalid, offshore, overlapping and boundary-ambiguous points abstain.
Natural Earth is cartographic geometry, not cadastral truth; even detailed data
can omit a narrow coastal strip. For example the public synthetic Kuta coastal
point (-8.717, 115.174) remains unresolved while inland Bali points resolve.
Names describe supported photo locations, not proof of owner presence. Two
independent committed evidence families must corroborate each named place.
Region boundaries use country fallback; unresolved countries use neutral text.
Mixed regions use country names except for verified Vietnamese stop names.
Multiple countries remain multiple.

Vietnam uses the separate `vietnam-localities-81297802.json` layer for
verified locality labels. The bundled Natural Earth Admin-1 Vietnam regions
remain withheld. The layer maps 42 selected 2020 district footprints to 14
city names. It includes Sa Đéc, the five reviewed urban Cần Thơ districts,
Huế, Hội An, Đà Lạt, Nha Trang, Quy Nhơn, Vinh, Vũng Tàu, Phú Quốc, Hạ Long
and selected urban districts of Hà Nội, Đà Nẵng and TP. Hồ Chí Minh.
These are recognizable locality names for geographic footprints from the
dated source. Current administrative boundaries may differ.

`vietnam-provinces-cod-2020.json` adds the 63 province-level features in
the [archived Government of Viet Nam/OCHA COD](https://data.fieldmaps.io/cod/originals/vnm.shp.zip),
distributed under [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/).
The generator verifies the archive SHA-256 and source validity date.
It simplifies the geometry to 0.001 degrees before packing to four decimals.
The runtime uses this fallback for dated support from 2020-01-03 through
2024-12-31. The conservative cutoff precedes the administrative change in
[resolution 175/2024/QH15](https://vanban.chinhphu.vn/?classid=1&docid=211916&orggroupid=1&pageid=27160).
Outside that period, verified urban footprints and country labels remain
available. Generate the packed historical layer with
`uv run --with pyshp==2.3.1 --with shapely==2.1.2 scripts/build-destination-data.py --vietnam-provinces VIETNAM_COD.zip`.
The 2025 Sa Đéc ward was formed from
eight former city units. The generated file keeps the source shape IDs and
rounds geometry to 0.0001 degrees, using the same ring encoding and conservative
margin as the existing resolver. Locations outside the reviewed footprints,
near an edge, or with conflicting support use the country fallback.

The geographic layer is adapted from OCHA ROAP and the Government of Viet Nam
via geoBoundaries gbOpen, boundary `VNM-ADM2-81297802`, commit `9469f09`.
Source metadata and redistribution license are available from the
[geoBoundaries API](https://www.geoboundaries.org/api/current/gbOpen/VNM/ADM2/)
and [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/).
Independent locality and public reference controls were checked against the
[Đồng Tháp provincial portal](https://dongthap.gov.vn/vi/ubnd-phuong-sa-dec),
[Cần Thơ city plan](https://media.cantho.gov.vn/wps/wcm/connect/43f2b445-7267-4751-82c5-96a489fab68d/588979.pdf),
and GeoNames settlement entries [Sa Đéc](https://www.geonames.org/1568212/sa-dec.html)
and [Cần Thơ](https://www.geonames.org/1586203/can-tho.html).

Names are derived at read time from the selected committed run, so existing
trip labels refresh without a schema migration, reimport, or correction change.
Country statistics persisted under the old dataset version require the normal
rebuild before they can be treated as current.

## Offline Home search

`home-gazetteer-geonames.json` adapts the GeoNames gazetteer under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) using the source
coordinates as selectable place points. It covers named Vietnamese
administrative levels and seats in the published snapshot and major cities
outside Vietnam. Coverage follows the gazetteer snapshot, including some
historical administrative names. Selection and effective date
confirmation are required. The default radius is 20 km and a legacy Home keeps
its saved radius and exact dates when the owner chooses a replacement point.
Search uses only the bundled gazetteer points.
The query and selected point stay on the device.

To rebuild both assets, place the publisher's exact `VN.txt`,
`cities15000.txt`, `admin1CodesASCII.txt`, `countryInfo.txt` from the
[GeoNames extracts](https://www.geonames.org/export/) and the pinned
[geoBoundaries simplified GeoJSON](https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/VNM/ADM2/geoBoundaries-VNM-ADM2_simplified.geojson)
named `vietnam-adm2.geojson` into a local scratch directory. Run
`node scripts/build-atlas-geography.mjs <scratch directory>`, then
`node scripts/build-history-domain.mjs`. The generator verifies all source
digests and preserves the sources and licensing in the generated asset
metadata. Revalidate the controls before intentionally changing source
versions.
