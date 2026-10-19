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
Mixed regions use country names, and multiple countries remain multiple.

Names are derived at read time from the selected committed run, so existing
trip labels refresh without a schema migration, reimport, or correction change.
Country statistics persisted under the old dataset version require the normal
rebuild before they can be treated as current.
