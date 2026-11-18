# Ewha Campus Complex reference index

`ewha-campus-embeddings.json` contains normalized image and regional embeddings
extracted from resized public photographs using the bundled DINOv2 Small model.
The index includes the full photographs and a central portrait crop of each.
The index is licensed
under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

| Original file name for the generator | Photographer and source | Original license |
| --- | --- | --- |
| `campus-eckert.jpg` | Ken Eckert, [Ewha Campus Complex](https://commons.wikimedia.org/wiki/File:Ewha_Campus_Complex.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `campus-bolz.jpg` | Christian Bolz, [Ewha Womans University Campus new](https://commons.wikimedia.org/wiki/File:Ewha_Womans_University_Campus_new.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `campus-bolz-other.jpg` | Christian Bolz, [Ewha Womans University campus](https://commons.wikimedia.org/wiki/File:Ewha_Womans_University_campus.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `campus-hdb.jpg` | Hdb1115, [이화여자대학교 ECC](https://commons.wikimedia.org/wiki/File:%EC%9D%B4%ED%99%94%EC%97%AC%EC%9E%90%EB%8C%80%ED%95%99%EA%B5%90_ECC.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| `campus-wong1.jpg` | wongwt, [梨花校園複合園區](https://www.flickr.com/photos/wongwt/19461814899/) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| `campus-wong2.jpg` | wongwt, [梨花校園複合園區](https://www.flickr.com/photos/wongwt/19460393308/) | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/) |
| `campus-pfeiffer.jpg` | Otraff, [Ewha Women's University main building](https://commons.wikimedia.org/wiki/File:Ewha_Women%27s_Univ_Main_Buildingl-20070908.JPG) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |

Put the public JPEGs under an ignored directory and run the following from
the project root. The Flickr sources use the 1024-pixel JPEG variant. Any
additional JPEG file names are evaluation queries and are excluded from the
generated reference index.

```powershell
npm install --prefix data/private/atlas-landmark-eval/onnx-runtime --no-save --ignore-scripts onnxruntime-node@1.23.2
node apps/mobile/scripts/build-visual-landmark-index.cjs data/private/atlas-landmark-eval
```

The [campus guide](https://cms.ewha.ac.kr/user/ewhawelcome2/download/CampusGuidemap_eng.pdf)
identifies the complex. The app treats image similarity as a clue about the
depicted place and requires confirmation to add the journey.

To compare another set, pass `--sources=<manifest.json>` and `--check-only`
after the directory. The manifest is an array of records with a JPEG basename
in `source`, a catalog ID in `placeId`, a scoring profile in `kind` and an
optional `rotateClockwise` boolean. Holdout JPEG names must be disjoint from
the manifest. Record license, provenance, independent positives and lookalike
controls before adopting a new set.

The initial tower comparison used public photographs by [Josh Hallett](https://commons.wikimedia.org/wiki/File:N_Seoul_Tower_(6).jpg),
[lumoplank](https://commons.wikimedia.org/wiki/File:Namsan_Tower,_Seoul_-_Namsan2299.jpg)
and [FLASHPACKER TRAVELGUIDE](https://commons.wikimedia.org/wiki/File:N-Seoul-Tower_and_Namsan_Park_(26876783888).jpg).
The independent [park night view](https://commons.wikimedia.org/wiki/File:Seoul_Tower_from_Namsan_Park_(9595146693).jpg)
and [city view](https://commons.wikimedia.org/wiki/File:Seoul_and_N_Seoul_Tower.jpg)
both abstained with the existing image threshold. The bundled image index
continues to cover only Ewha. No tower reference images or vectors from this
comparison are distributed.
