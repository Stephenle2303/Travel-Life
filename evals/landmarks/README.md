# Atlas landmark benchmarks

## Automatic regional retrieval

The [base fixture](public-regional-v1.json) compares the phone's Ewha-only
visual matcher, a starter reference set and automatic routing to a deep
regional pack. The scorer runs the mobile matcher, episode sampler, stop
qualification and exact album assembly. Korea reuses published regression
captures. The first Hanoi episode uses four newly pinned query captures from
photographers disjoint from the references. The [second Hanoi episode](public-regional-hanoi-holdout-v1.json)
was selected after freezing the exploratory multi-view and local-detail
policy and before scoring any of its images. Groupings and timestamps are
synthetic. Originals and descriptors stay in the ignored public eval folder.

The ordinary regional route reached Korea and left one Namsan capture
unrecognized. Hanoi did not route. An oracle given the correct region and
the full deep pack still missed both new Khuê Văn Các views in the first
Hanoi episode. The exploratory comparison trials one full image and five
65% overlapping crops. It requires two agreeing crop hits and withholds
conflicting labels. An existing v3 local-detail verifier can fill remaining
inconclusive observations after the region has been established.

The combined comparison recovered the exact first Hanoi and Seoul episodes,
including four album members each. It rejected the mixed-country and
outside-index episode controls. The second Hanoi set still lacked Tháp Rùa
support and did not produce an album. These are reusable model experiments,
and no release artifact passed. Extracting six descriptors per query carries
an Android runtime cost that has not been measured. Even with the full
Vietnam pack supplied by the scorer, the same crop policy missed both
Tháp Rùa views in the second episode. A screenshot excluded
by intake does not cover a camera photo of a screen showing a landmark.

For reproducibility, place the `queryPhotos` downloads and the cited parent
manifest images in the same ignored input folder used below. Check the pinned
digests before scoring. Run with a new output directory for each invocation.

```powershell
$first = '23aa650d7700b88932b30e6a7fad20850117435f757603e5881f1985d1c80db4'
$second = 'ead2d07d72bd1c4dd38a8bcc06b02143f8e86369eee79176cdd4b9905eb3e2f8'
$inputDir = 'data/private/atlas-landmark-eval'
node evals/landmarks/benchmark-regional-landmarks.cjs $inputDir evals/runs/atlas-regional-whole-v1 $first
node evals/landmarks/benchmark-regional-landmarks.cjs $inputDir evals/runs/atlas-regional-views-v1 $first --compare-views $second
```

A scored failure returns 1 and writes a closed `GATE_NOT_MET` event and
`report.json`. A raw tool or source failure returns 2. The `--compare-views`
run always writes an evaluation report only. `withKnownCountry` and
`withKnownCountryViews` are diagnostics with a supplied region. Their results
do not count toward automatic routing or release. The app can use a public
dev release only if a regular gate run emitted a `releaseManifestSha256`.

## Public landmark benchmark v1

This host evaluation uses public landmark photos and a synthetic meter screen.
Run both models locally. The model checkpoint, image inputs and generated
descriptor packs stay outside the app and Git. Each approved image has a pinned
download URL and digest in [the fixture manifest](public-benchmark-v1.json).
The two episode sequences use synthetic timestamps and groupings.

## Public source audit

| Place | Wikidata | GLDv2 class / cleaned image IDs | Starter / deep reference images | Independent queries |
| --- | --- | --- | --- | --- |
| Ewha Womans University | Q41114 | No exact class in the category table | 1 / 3 | 2 |
| N Seoul Tower | Q69134 | 143338 / 30 | 0 / 0 | 0 |
| Namiseom | Q487536 | 53917 / no cleaned row | 1 / 2 | 2 |
| Tháp Rùa | Q1134533 | 134878 / 18 | 1 / 2 | 2 |
| Khuê Văn Các | Q110895486 | No exact class in the category table | 0 / 2 | 2 |

The [GLDv2 metadata tables](https://github.com/cvdfoundation/google-landmark#download-train-set)
had SHA-256 `ac603f465eb9edff862d54804c8caa13c18783550273dfa502154615f33d90d7`
for the category table and
`d353df467a0c4b9825d9b5379ab51e1697e81f65863132cedffabc1ece597ac9`
for the cleaned ID table. All 48 cleaned IDs for N Seoul Tower and Tháp Rùa
joined against attribution table ETag `1e23ca8cf226471e191ed5ad87114ee5-121`.
GLDv2 supplied discovery and provenance leads. The scored set uses reviewed
[Commons file metadata](https://www.mediawiki.org/wiki/API:Imageinfo) and photo
inspection. Namiseom's previous entity Q27308542 resolves to Q487536 in the
[Wikidata entity snapshot](https://www.wikidata.org/wiki/Q487536).

The manifest accounts for 32 candidates. The 24 admitted images comprise
9 references and 15 queries. The 8 exclusions include a repeat capture,
generic views, a viewpoint facing away from its target, and tower close-ups
with unresolved underlying-work rights. The [Commons tower category](https://commons.wikimedia.org/wiki/Category:N_Seoul_Tower)
flags freedom-of-panorama restrictions even when the photographer has
applied a Creative Commons license. The current approvals apply to this
local fixture. Distribution requires review of underlying-work rights,
attribution and any share-alike obligations for the released artifacts.
The [Korea Tourism Organization's Namsan record](https://korean1.visitkorea.or.kr/enu/nphotogallery/photo.kto?func_name=photo_view&newphotoDTO.photo_code=1510042201705017k&newphotoDTO.searchWord=&newphotoDTO.sub_menu=plan&newphotoDTO.sub_menu_detail=44737)
is a possible source for a later snapshot. The item displays KOGL Type 1,
and the gallery also lists registration, requested-use and download terms.
It was not used in the pilot.
SALAD's upstream code is [GPLv3](https://github.com/serizba/salad/blob/6aede13a3f6c25750bf7fde10209c06cb73060bb/LICENSE).
Its public checkpoint and upstream source are used for local evaluation.

## Reproduce on Windows

Use a fresh destination under `evals/runs/` for each invocation. Install
the mobile workspace dependencies using its lockfile. The Python dependency
command uses the [PyTorch CPU index](https://docs.pytorch.org/get-started/previous-versions/).
Use Python 3.12 for the versions measured here.

```powershell
$root = 'data/private/atlas-landmark-eval'
$manifest = 'evals/landmarks/public-benchmark-v1.json'
$manifestHash = '608dfb2647fe01cd4dbec2432fe86ed5c633ca5287043d4d517d8f4019952b8e'
$python = 'python'
New-Item -ItemType Directory -Force -Path $root, 'evals/runs' | Out-Null
npm install --prefix "$root/onnx-runtime" --no-save --ignore-scripts onnxruntime-node@1.23.2
& $python -m pip install --target "$root/salad-python" --index-url https://download.pytorch.org/whl/cpu torch==2.8.0 torchvision==0.23.0 pillow==13.0.0 numpy==2.5.4
$env:PYTHONPATH = (Resolve-Path -LiteralPath "$root/salad-python").Path
$env:XFORMERS_DISABLED = '1'

# Keep the source's pinned variant. A changed JPEG must be reviewed for a new fixture.
$publicPhotos = (Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json).photos
foreach ($photo in $publicPhotos | Where-Object review -eq 'approved') {
  $image = "$root/$($photo.file)"
  if ($photo.source -eq 'synthetic') {
    Copy-Item -LiteralPath "evals/landmarks/$($photo.file)" -Destination $image
  } elseif (-not (Test-Path -LiteralPath $image)) {
    curl.exe --fail --silent --show-error --max-time 30 --user-agent 'TravelLifeLandmarkEval/0.1 (public reference audit)' $photo.downloadUrl --output $image
    if ($LASTEXITCODE -ne 0) { throw 'Public photo download failed' }
  }
  if ((Get-FileHash -LiteralPath $image -Algorithm SHA256).Hash -ine $photo.sha256) {
    throw 'Public photo bytes differ from the frozen fixture'
  }
}

curl.exe --fail --location https://github.com/serizba/salad/releases/download/v1.0.0/dino_salad.ckpt --output "$root/dino-salad-v1.ckpt"
curl.exe --fail --location https://codeload.github.com/serizba/salad/zip/6aede13a3f6c25750bf7fde10209c06cb73060bb --output "$root/salad-src.zip"
curl.exe --fail --location https://codeload.github.com/facebookresearch/dinov2/zip/7764ea0f912e53c92e82eb78a2a1631e92725fc8 --output "$root/dinov2-src.zip"

node apps/mobile/scripts/benchmark-offline-landmarks.cjs $manifest $manifestHash $root evals/runs/atlas-public-v1-audit --audit-only
$descriptors = "$root/salad-public-v1-descriptors.json"
& $python evals/landmarks/extract-salad.py $manifest $manifestHash $root "$root/dino-salad-v1.ckpt" "$root/salad-src.zip" "$root/dinov2-src.zip" $descriptors
if ($LASTEXITCODE -ne 0) { throw 'SALAD descriptor extraction failed' }
$descriptorHash = (Get-FileHash -LiteralPath $descriptors -Algorithm SHA256).Hash.ToLowerInvariant()
node apps/mobile/scripts/benchmark-offline-landmarks.cjs $manifest $manifestHash $root evals/runs/atlas-public-v1-paired $descriptors $descriptorHash
```

An audit exits 0 on valid input and records any coverage gap in its report.
A score exits 0 on a passed public gate, 1 on a failed or incomplete gate,
2 on tool failure, or 130 on interruption. Read the single run correlation
in the closed JSON events and the report in the requested destination.
No owner photo or derivative enters the fixture, tool, or download requests.

## Frozen result

The deep comparison scores both matchers against the same nine reference
originals and 15 queries. The current DINOv2 visual matcher uses its
full and portrait reference views. SALAD uses official 322-pixel input,
8,448-dimensional descriptors and a frozen 0.65 cosine / 0.08 margin.
OCR and device album qualification are outside this comparison.

| Host matcher / index | Correct positives / 8 | Incorrect matches on controls / 7 | Abstained / 15 |
| --- | ---: | ---: | ---: |
| DINOv2 starter | 3 | 1 | 11 |
| DINOv2 deep | 7 | 1 | 7 |
| SALAD starter | 0 | 0 | 15 |
| SALAD deep | 0 | 0 | 15 |

The fixed and progressive policies each used four attempts per episode.
With deeper references, both policies found four of four episode stops
with DINOv2 and zero with SALAD. Both models routed zero of two episodes
from starter evidence. The progressive pilot uses fixture session labels.
The fixed sampler infers sessions from timestamps. The two fixture sessions
per episode are each within an hour and separated by a day. The release gate
also requires a wholly out-of-index episode. The frozen v1 fixture contains
individual out-of-index controls and lacks that episode.

The SALAD starter plus the larger regional pack used 1,465,753 bytes
including both manifests. SALAD's checkpoint is 352,040,378 bytes separately.
On the Windows CPU host, extraction runs averaged about 0.8–1.0 s per image.
A sampled peak working set on the second run was 1,097,412,608 bytes.
The DINOv2 runner generated 33 full/query/crop descriptors in about 1.33 s
after image decode. Host timing and process memory are distinct from
Android measurement.

The single DINOv2 false match was the Damyang avenue misidentified as
Nami in both the starter and deep configurations. SALAD's top-ranked deep
result was correct for all eight positive queries,
with scores from 0.314 to 0.589. The Damyang tree-lined avenue ranked Nami
first at 0.393, above the weakest correct Nami view. These are exploratory
observations from the scored fixture. They motivate a separate calibration
set and a new untouched holdout for a verifier based on discriminative
details or corroborating evidence. Keep the v1 threshold and labels frozen.

The public gate is incomplete with Namsan withheld. SALAD also failed the
stop improvement and automatic routing checks. This pilot did not qualify
any pack for activation. Android scan time, peak memory, actual trip
discovery and exact album readback remain unmeasured.

## Competing-reference verifier v2

The [v2 manifest](public-verifier-v2.json) freezes a 0.035 similarity margin
and 28 inputs. The unchanged DINOv2 rule proposes a place. For Nami and
Namsan, the verifier compares that place's closest reference to its closest
reviewed counterexample, using the mean of global, pooled and regional
similarity. The candidate must clear the frozen margin. Counterexamples
cannot propose a place. The portable packs retain their role and provenance.

The Namsan fixture has four 2020 references and two 1995 queries from the
Seoul Institute. Its records display both CC BY 4.0 and KOGL Type 1.
The credited publisher is Seoul Metropolitan Government. The archive
editions establish distinct capture campaigns. A second reference publisher
was not verified for this fixture, so Namsan remains below the reference
diversity gate. [Archive reuse and attribution](https://data.si.re.kr/node/65175),
[2020 reference](https://data.si.re.kr/photo/06u00102aa10000),
[1995 query](https://data.si.re.kr/photo/01101709aa0000).

Use the same public download loop as v1 with the v2 manifest. The manifest
pins each public image variant and the digest of the local synthetic billing
screen. Run the Node scorer without SALAD descriptors.

```powershell
node apps/mobile/scripts/benchmark-offline-landmarks.cjs evals/landmarks/public-verifier-v2.json d20e322ec24036bfbe1b6d58c3e33d0557487cb4a33f9b6ad54320f4d1e81f44 data/private/atlas-landmark-eval evals/runs/atlas-public-verifier-v2
```

| Deep-index policy | Correct positives / 7 | Incorrect matches on controls / 5 |
| --- | ---: | ---: |
| Current DINOv2 rule | 3 | 1 |
| DINOv2 with competing references | 3 | 0 |

The new Damyang park photo was the rejected false match. The v1 winter
Damyang image was also rerun as a known regression outside the v2 counts.
It still passed the verifier as Nami. The verifier preserved one correct
Nami match, one Tháp Rùa match and one Khuê Văn Các match. Both policies
abstained on the two Namsan photos, the water meter and the billing
screenshot. On the assembled episodes, both recovered 3/5 deep-index stops
and routed 0/2 known regions. The new outside-index episode was unrouted.

The v2 score remains `COVERAGE_INCOMPLETE`. It also misses the stop-gain
and routing requirements. Keep both score sets frozen. The next candidate
needs a distinct landmark signal beyond global scene resemblance, and new
sources covering modern Namsan viewpoints. Measure the candidate on fresh
holdout captures after calibration. Device resource and album acceptance
remain open.

## Local landmark detail v3

The [frozen v3 fixture](public-detail-v3.json) adds the Seoul Tourism
Archive as a second reference source for Namsan and an independent
2010 dusk query from the Seoul Institute. The six reference photographs
come from the 2020 Seoul Metropolitan Government edition and two Seoul
Tourism Organization collections. The three scored Namsan queries come
from the 1995 and 2010 Seoul Metropolitan Government editions.

Source credit for the tourism photographs is Seoul Tourism Organization,
Seoul Tourism Archive. The item records identify the materials as KOGL
Type 1. The benchmark uses the published JPEG previews, with the tower
area marked on reference images only. [Baekbeom Square Park](https://archive.visitseoul.net/en/contents/ARP007ra1),
[National Museum of Korea](https://archive.visitseoul.net/en/contents/ARP008821),
[archive copyright policy](https://archive.visitseoul.net/en/page/copyright),
[Seoul 2010 Urban Form and Landscape](https://data.si.re.kr/photo/04x00508ac0000).

The input manifest pins the regions, a 0.70 minimum similarity and a
0.04 positive-versus-counterexample margin before scoring. Queries are
searched over the whole photo. The winter Damyang regression remains
outside the scored split. Reuse the public download loop and synthetic
screen instructions from v1 with the v3 manifest and digest below.

```powershell
node apps/mobile/scripts/benchmark-landmark-details.cjs evals/landmarks/public-detail-v3.json b9f50daad8e6ddc0399d9d48de101fb1a1c4a6d2d6751530438de0db8b32a176 data/private/atlas-landmark-eval evals/runs/atlas-landmark-detail-v3
```

| Matcher | Namsan recognized / 3 | Other images labeled Namsan / 10 |
| --- | ---: | ---: |
| DINOv2 scene match | 1 | 0 |
| DINOv2 scene match with competing references | 1 | 0 |
| DINOv2 local patch layout | 3 | 0 |

The local matcher reuses the same encoder and looks for a spatially
consistent arrangement of patches across five scales. It passed the
target-only host gate. Two runs produced identical non-timing scores
and source coverage. The benchmark took 6.28–6.84 s per run, including
0.45 s for matching and 418–419 MB peak process RSS.
[DINOv2 model card](https://github.com/facebookresearch/dinov2/blob/main/MODEL_CARD.md).

Both scene matchers still called the known winter Damyang photo Nami.
The local matcher only emits Namsan, so its abstention on that photo
measures rejection of a non-Namsan input. It does not resolve Nami.
The fixture reuses v2 controls and two Namsan queries, and adds one
previously unscored dusk query. Treat it as a small paired follow-up.
Its target gate does not measure automatic region routing, album accuracy,
Android resources or end-to-end trip recovery.

## Seoul multi-stop host experiment

This calibration probe joins the existing sampler, observation merger,
trip qualification and album association on public photographs with
synthetic capture times and no GPS, date query, selected photos or
location hint. It uses the pinned v1 Ewha queries and v3 model and
references. The added ferry query is Jocelyndurrey's Commons photograph,
revision 1135753421, CC BY-SA 4.0, pinned JPEG SHA-256
`6429aca19ec8f112e57e31a901855cdf5b4da5773df6aac040080ab440f8d7b`.
The other ferry photo is by Minseong Kim, CC BY-SA 4.0, pinned in v3.
The two authors photographed the same ferry banner at different times.
[Jocelyndurrey photo](https://commons.wikimedia.org/w/index.php?title=File:%EB%82%A8%EC%9D%B4%EC%84%AC_(2).JPG&oldid=1135753421),
[Minseong Kim photo](https://commons.wikimedia.org/wiki/File:Gapyeong-Nami_Island_Ferry.jpg).

| Trial | Qualified stops | Album photos |
| --- | --- | ---: |
| Frozen scene verifier | No proposal | 0 |
| DINOv2 with local Namsan patch matching | Ewha, Namsan | 4 |
| Same candidate with transcribed ferry banner | Ewha, Nami, Namsan | 6 |
| Same candidate with whole-image Windows OCR or exact tiled OCR | Ewha, Namsan | 4 |
| Fixed overlapping tiles with spelling tolerance | Ewha, Nami, Namsan | 6 |
| Meter moved into the ferry sample bucket | Ewha, Namsan | 4 |
| Same crowded bucket with bounded follow-up | Ewha, Nami, Namsan | 6 |
| Synthetic two-day episode, automatic OCR | Ewha, Nami, Namsan | 6 |

The automatic probe OCRs the full public image and a 3×3 grid of
overlapping half-width, half-height crops. It accepts the normalized
banner phrase within three character edits. Atlas's existing document
veto and two-distinct-capture stop rule still apply. The host sampler
retains the ends of each four-hour bucket. In the crowded case it kept
the meter and one ferry photo. The host follow-up drew from the retained
ten-minute coverage within 90 minutes of a recognized singleton, capped
at four extra photos. The case needed one extra photo. The public OCR
results were computed in batch before the probe simulated photo selection.

All successful three-stop trials matched the six exact intended album
members. The meter was sampled and rejected. The screenshot was excluded
by origin in the main trials and still stayed out when explicitly given
a capture-like origin and scanned. Winter Damyang, the generic Nami
tree lane and Tokyo Skytree were excluded. A synthetic ferry-ticket OCR
control exercised the document veto. Separately, the existing dense
episode SQLite test verified staging, exact album readback, rollback
and idempotent confirmation with its synthetic inputs.

The local experiment files and report are in the ignored
`data/private/atlas-landmark-eval/` directory. After generating the
Windows OCR outputs with `episode-ocr.ps1`, `episode-tiles.py` and
`episode-tile-ocr.ps1`, run `node data/private/atlas-landmark-eval/episode-probe.cjs`
from the checkout. The two final runs reproduced identical stop and
album results. Model inference and assembly took 6.16–6.73 s with
415–416 MiB peak process RSS, excluding the separate OCR batch.
These tests exercise exact album precision on a small constructed set.
They do not measure general trip-photo recall, unseen signage accuracy,
automatic region routing or native device performance.

## Nami independent host evaluation

The [frozen fixture](nami-holdout-v1.json) contains six photos taken on
Nami, two images of similar scenes elsewhere, and four synthetic
printed controls. Four Nami views contain specific subjects
(entrance gate, stone sign, riverside pavilion and tomb). Two generic
views measure deliberate abstention on nonspecific scenery. The
manifest records image digests, credits, Commons revisions and
renditions. Original-file identity and image SHA-256 were compared
against the three earlier manifests. View independence is limited:
three specific-site views are from one photographer and one visit.
The held-out gate is from a second photographer.

The scorer reuses the calibrated DINOv2 detail and OCR rules without
changing thresholds. All 12 independent images were scanned for
image-level scoring. Seven assembled episodes used known Ewha and
Namsan anchors, synthetic times, the existing automatic sampler and
the calibrated bounded follow-up. The gate requires recognition from
two independent Nami photographers, zero false location labels for
printed or off-site controls, at least one exact positive album, and
zero contaminated negative albums. The original ferry calibration
episode is a separate positive control.

| Measure | Result |
| --- | ---: |
| Specific new Nami scenes recognized | 0/4 |
| Generic Nami scenes withheld | 2/2 |
| Other-place scenes falsely placed | 0/2 |
| Printed controls falsely placed | 3/4 |
| Distinctive positive episodes with the exact expected album | 0/3 |
| Negative episodes containing false photos | 1/3 |
| Original six-photo calibration control | Passed |

The plain prints created a Nami stop between Ewha and Namsan and both
entered the album. The fourth printed control was a clearly marked
ticket and triggered the document veto. In the crowded positive
episode one unscanned gate photo remained in retained coverage,
but the follow-up had no recognized Nami observation to trigger it.
No photo was sent to an external model provider.

After scoring, the exact catalog alone still produced the false
stop from both prints. Requiring corroboration from the existing
scene verifier blocked them and also removed Nami from the calibrated
ferry case. These are diagnostic comparisons on an exposed set.
The next visual policy needs multiple independent views of actual
landmarks and hard negatives containing the same place name. A fresh
holdout must measure any newly calibrated decision.

The local probe and report are
`data/private/atlas-landmark-eval/nami-holdout-probe.cjs`
and `data/private/atlas-landmark-eval/nami-holdout-report.json`.
Use the pinned fixture and the adjacent Windows OCR outputs to replay
the score. The report retains each photo prediction, unscanned target,
stop and exact album membership. Windows OCR and a preloaded deep index
do not establish automatic region routing or Android resources.

## Nami visual detail and copied images

The [pinned fixture](nami-visual-v1.json) covers a Nami ferry, the
island memorial of General Nam Yi and the zipline tower across the
river. It includes a different ferry and the similarly named burial
site in Hwaseong as competitors. The zipline is the only fresh
positive. The ferry and zipline query photos are from one photographer
and trip. Other previously seen positives are regression evidence.
[Ferry reference](https://commons.wikimedia.org/wiki/File:Gapyeong-Nami_Island_Ferry.jpg),
[island memorial](https://commons.wikimedia.org/wiki/File:Tomb_of_General_Nam_Yi_of_Chosun_Dynasty_-_panoramio.jpg),
[Hwaseong burial site](https://commons.wikimedia.org/wiki/File:%EB%82%A8%EC%9D%B4%EC%9E%A5%EA%B5%B0%EB%AC%98.jpg),
[zipline query](https://commons.wikimedia.org/wiki/File:%EB%82%A8%EC%9D%B4%EC%84%AC_(4).JPG).

The host matcher compares local DINOv2 patch layouts against positive
and competing regions. Text nomination does not lower its visual
threshold. A separate local OpenCV check estimates a geometric
transform from SIFT correspondences and requires 25 inliers,
55 percent inlier fraction and 20 percent known-source coverage.
The paper and screen simulations use indexed originals. The third
simulation uses a borderless crop of an unindexed image.
[OpenCV geometric matching method](https://docs.opencv.org/4.x/d1/de0/tutorial_py_feature_homography.html).

| Comparison | Fresh view accepted | Prior Nami views accepted | False accepts on 12 controls | Exact positive assembly |
| --- | ---: | ---: | ---: | --- |
| Frozen 0.70 threshold | 0/1 | 0/3 | 0 | None |
| Exploratory 0.55 with geometry check | 1/1 | 0/3 | 0 | None |
| Exploratory 0.50 with geometry check | 1/1 | 1/3 | 1 | Zipline and ferry, 3 stops and 6 photos |

At 0.50 the borderless reproduction also matched. Pairing it with
the real zipline produced a false Nami stop and included the copy.
The geometry check recognized both indexed simulations (503 and
168 inliers) and missed the unindexed copy. Full-view patch similarity
did not classify the indexed images as copies. The frozen detail
threshold abstained on them. Plain prints, winter Damyang, the meter
and screenshot stayed out of the tested albums.

The probe uses the production sampler, trip qualifier and album
assembler on synthetic capture times and a preloaded deep index.
The matcher is host-only. Automatic region routing and device
thresholds remain open. Acquire independent viewing campaigns and
an off-site zipline tower control before the next gate. The one fresh
zipline view has no subject-matched competing template in this run.
Capture context is needed to resolve a copy whose original is absent.

Use the baseline v1, v3 and Nami holdout inputs described above.
Download the additional JPEG renditions to the same directory from
the pinned manifest and verify the reported SHA-256 values. The
runner loads the model and sampler pinned by the v3 benchmark. For
image generation and matching, the Windows run used Pillow 13.0.0,
NumPy 2.5.4 and opencv-python-headless 4.12.0.88. The copy report is
pinned to the measured geometry output. Run each policy with a fresh
report directory. Exit 1 means the report was written and quality
or coverage failed. Exit 2 indicates an execution fault.

```powershell
$inputs = 'data/private/atlas-landmark-eval'
python evals/landmarks/make-nami-reproductions.py $inputs
python evals/landmarks/measure-nami-image-copies.py $inputs
node evals/landmarks/benchmark-nami-visual.cjs $inputs evals/runs/nami-visual-frozen
node evals/landmarks/benchmark-nami-visual.cjs $inputs evals/runs/nami-visual-055 0.55
node evals/landmarks/benchmark-nami-visual.cjs $inputs evals/runs/nami-visual-050 0.50
```

## Nami capture evidence comparison

This host comparison replays the same pinned DINOv2 inputs and the
exploratory 0.50 threshold. The [ten-case fixture](nami-capture-evidence-v1.json)
supplies separate, simulated camera coordinates. Each record binds
to one sampled asset, capture family and capture time. Eligibility
requires a capture-like origin, accuracy at most 60 m and the
distance plus reported accuracy within 1.2 km of the public anchor.
The Nami location remains a private clue when evidence is missing
or conflicts. An independently located image can support the stop
without a visual match. Known copies and unqualified visual clues
do not enter album scene association. Ewha and Namsan retain
their previous visual evidence in both comparison branches.

| Outcome | Visual promotion | Separate capture evidence |
| --- | ---: | ---: |
| Exact expected stops and album, across ten cases | 5/10 | 6/10 |
| Genuine cases with missing or coarse coordinates | 3/3 | 0/3 |
| Copy with absent or conflicting location kept out | 0/2 | 2/2 |
| Undetected copy carrying the same eligible coordinates kept out | 0/1 | 0/1 |

All ten cases sampled their target controls and retained the
expected private clues. Nine of ten had the expected evidence
statuses. The undetected copy incorrectly qualified for promotion.
Both branches recovered the six-photo
album when both genuine positives were supported. When two
located captures established Nami, the capture branch kept a
sampled GPS-less image or an indexed reproduction out of the
otherwise qualified album. The original stop and membership
scores compare ordered IDs. They do not use the figure captions
or media dates as place hints.

Coordinates, accuracy and camera provenance are fixture inputs.
The benchmark merges the simulated located rows after the GPS-less
sampler. Both comparison branches use those same representatives
to isolate the decision rule. The current mobile GPS-less query
excludes located assets. No native GPS or provenance validation took place. The
two public JPEGs and the full-bleed copy lack GPS in the tested
bytes. The comparison therefore leaves real GPS-less recall
and the Android rollout gate open. Test additional independent
capture evidence before promoting visual matches in that path.

```powershell
$inputs = 'data/private/atlas-landmark-eval'
node evals/landmarks/benchmark-nami-visual.cjs $inputs evals/runs/nami-capture-evidence-v1 capture-evidence
```

Collect the closed `LANDMARK_PUBLIC_EVAL` events on stderr and
check `captureComparison` in the atomic report for each case's
private clues, ordered stops and album IDs. The measured quality
miss exits 1 and publishes the report.

## Nami multi-view geometry comparison

The [public fixture](nami-multiview-v1.json) tests related Nami
landmarks, different landmarks from one visit, off-site lookalikes
and synthetic copies. The photos and originals have the previously
reviewed provenance and byte pins in [the visual fixture](nami-visual-v1.json).
The geometry comparison uses no image coordinates from EXIF or
source metadata. It uses mutual SIFT correspondences, a robust
homography and a fundamental matrix fitted to the same points.
Coverage is measured in both frames. The experimental viewpoint
check requires at least 25 epipolar inliers, a 60 percent inlier
fraction, and at least 15 well-spread inliers outside the planar
model. Strong broad planar agreement remains a reason to withhold.
[OpenCV geometric fitting algorithms](https://docs.opencv.org/4.12.0/d9/d0c/group__calib3d.html).

| Host control or episode | Result |
| --- | --- |
| Synthetic nonplanar, planar and unrelated point controls | 3/3 expected classifications |
| Public same-subject independent captures | 0/3 supported as distinct viewpoints |
| Simulated reproductions paired with their source | 3/3 showed broad planar agreement |
| Genuine GPS-less zipline plus ferry | 5 mutual matches. Nami stayed pending and the album retained 4 anchor photos. |
| Genuine zipline plus unindexed crop | 2 mutual matches. Nami stayed pending and the copy was excluded. |
| Four negative trip episodes | 4/4 exact exclusion, including the previously false Nami album. |

The existing visual-only comparison admitted the genuine pair as six
photos and made the same three-stop album with the unindexed copy.
Pairing that copy with the exact original yielded 821 planar inliers
out of 830 mutual matches. This worked because both sides of the case
were available. Away from the source, the same policy could only
abstain. Planar agreement is also possible on a real flat subject.

In a separate exploratory sweep, increasing resolution and the
keypoint budget and relaxing the descriptor ratio did not exceed
12 epipolar inliers on the public pairs. The genuine scenes and
negative controls remained similarly weak. No threshold from this
experiment qualifies a GPS-less trip for rollout.

Run with the previously pinned public images and the same host
OpenCV and NumPy versions. Use fresh output destinations and keep
the geometry and benchmark reports local. A quality miss returns
1 from the Node scorer and still writes the report.

```powershell
$inputs = 'data/private/atlas-landmark-eval'
python evals/landmarks/measure-nami-multiview.py $inputs "$inputs/nami-multiview-measurements.json"
node evals/landmarks/benchmark-nami-visual.cjs $inputs evals/runs/nami-multiview-v1 multiview
```

## Partial Seoul proposal and photo membership

The host projection replays five scored Nami episode pairs with the
same Ewha and Namsan anchors. It projects a Seoul proposal only
when the existing trip qualifier and album assembler succeed.
Pending clues contribute a deduplicated place identity outside
the supported stops, covers and album. Reproductions, media outside
the sample and ineligible origins cannot supply a pending clue.
Pending observations lacking a separate decision stay out of album
scene association.

The five cases had the expected destination, ordered stops, stop
support, covers, album and pending places. Each album held four
photos. Four cases included one pending Nami place and the burial
site control included none. This narrower comparison treats the
genuine Nami episode as a partial success. In the overall trip
quality benchmark it still misses an actual stop and two photos.

In the synthetic scene test, two Ewha captures bracketed an unnamed
GPS-less scene with matching descriptors. It became the fifth
album member with the `scene` basis. It did not add stop support or
capture coordinates. An unrelated image, known copy and screenshot
with the same timestamp stayed out. Moving one matching anchor
outside the scene window kept the unnamed image out.

The public photo probe used an Ewha panorama under a synthetic
clock and explicitly supplied it from retained coverage. Against
the two campus anchors, its global scores were 0.397 and 0.419,
below the required 0.82. It remained outside the four-photo album.
The probe does not measure automatic album follow-up or natural
capture times. A separate exploratory check of other campus views
also found no image that met the existing scene rule against both
anchors. A passing synthetic branch does not establish real recall.

Run the prior pinned public fixtures and pair measurements through
the same scorer. Check `partialComparison` for exact proposal
and campus-scene results. The existing broader gate still returns
exit 1 and publishes the report.

```powershell
$inputs = 'data/private/atlas-landmark-eval'
node evals/landmarks/benchmark-nami-visual.cjs $inputs evals/runs/nami-partial-proposal-v1 partial-proposal
```

## Nano honesty eval (Story 1 Q3)

[The fixture](nano-honesty-v1.json) answers one question for
[decision 0019](../../docs/decisions/0019-gps-less-trip-discovery.md)'s Story
1: does on-device Gemini Nano (ML Kit `genai-prompt`) answer UNKNOWN honestly,
or bluff a place name, when the image gives no textual or landmark proof? Any
named place for a Sa Đéc control image disqualifies Nano as a clue source,
per the spec.

Five public Commons photos, each pinned by sha256: three Korea images (one
architecture-only, two with readable Hangul road signs) and two Vietnam/Mekong
Delta controls, one captioned as Sa Đéc's own central market. Download
originals into the ignored `evals/runs/nano-honesty-cache/` folder and verify
each against its pinned digest before use; the thumbnail origin
(`upload.wikimedia.org/.../thumb/...`) is more reliable than the full-size
origin, which has returned transient `429`s in this project before. A `HEAD`
request immediately before the `GET` reliably cleared a 429 in this run.

The eval runs on-device only (`apps/mobile/src/app/dev-travel-window.tsx`, a
dev-only harness, not production code): push the five cached images to the
device, run each through `TravelLifeSignage.nanoDescribeImage` with the
spec's exact prompt, and score the response with `scoreNanoAnswer` from
`apps/mobile/src/travel-window/nano-honesty.ts`. A single `bluff` outcome on
any control image fails the bar (`passesHonestyBar`), regardless of how the
Korea images score. See `_bmad-output/specs/spec-gps-less-trip-discovery/delivery.md`
for results once run.
