'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { registerHooks, stripTypeScriptTypes } = require('node:module');
const { performance } = require('node:perf_hooks');
const { fileURLToPath, pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../..');
const mobile = path.join(root, 'apps/mobile');
const sourceRoot = path.join(mobile, 'src');
const sourceUrl = pathToFileURL(sourceRoot + path.sep).href;

function loadTripRecovery() {
  const hooks = registerHooks({
    resolve(request, context, next) {
      if (context.parentURL?.startsWith(sourceUrl)) {
        if (request.startsWith('@/')) return next(new URL(request.slice(2) + '.ts', sourceUrl).href, context);
        if (request.startsWith('.') && !path.extname(request)) {
          return next(new URL(request + '.ts', context.parentURL).href, context);
        }
      }
      return next(request, context);
    },
    load(url, context, next) {
      if (url.startsWith(sourceUrl) && url.endsWith('.ts')) {
        const source = fs.readFileSync(fileURLToPath(url), 'utf8');
        return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(source, { mode: 'transform' }) };
      }
      return next(url, context);
    },
  });
  try {
    return require(path.join(sourceRoot, 'visual-place/trip-recovery.ts'));
  } finally {
    hooks.deregister();
  }
}

const loadScript = (name) => require(path.join(mobile, 'scripts', name + '.cjs'));
const input = loadScript('offline-landmark-input');
const model = loadScript('offline-landmark-model');
const detail = loadScript('offline-landmark-details');
const manifest = (name, digest) => input.parseManifest(input.readPinned(
  path.join(root, 'evals/landmarks', name + '.json'), digest));
const mapping = { ewha: 'ewha-womans-university', namsan: 'namsan-seoul-tower', nami: 'nami-island' };
function buildRows(schedule) {
  return schedule.map(([id, time, origin = 'capture-like']) => {
    const captured = Date.parse('2026-01-08T' + time + ':00Z');
    return {
      evidence_id: id, source_ref: id, family: id,
      captured_day: new Date(captured + 9 * 3600000).toISOString().slice(0, 10),
      captured_at_millis: captured, source_origin: origin,
    };
  }).sort((a, b) => b.captured_at_millis - a.captured_at_millis);
}

const { publishArtifacts } = loadScript('offline-landmark-benchmark');
const { createNamiCorroborator, matcherVersion } = loadScript('offline-nami-corroboration');
const fixturePin = '576bef18d90e8293c8bf782a6aacb598909f0abe19673c1cb3e2e7ad7e4acf93';
const captureFixturePin = '83191f1bd10dfb59efb3fa3a54ad1f15126459e896307a6678a0960c231978b2';
const multiviewFixturePin = '0def651c68464b15d918ed952e68ae535b532f314f82e93cee5400b32921c908';
const multiviewMeasurementsPin = '6f39d040bd13010634f2d6a14bad9a6f7b79693be29bb5835c4794458f817797';
const anchors = [
  ['ewha-2008', '00:05'], ['ewha-2019', '00:10'],
  ['v2-water-meter', '04:05'], ['control-damyang', '04:10'],
  ['si-01101709aa0000', '12:05'], ['si-04x00508ac0000', '12:10'],
  ['synthetic-billing-screen', '16:05', 'screenshot'],
];
const anchorIds = ['ewha-2008', 'ewha-2019', 'si-01101709aa0000', 'si-04x00508ac0000'];
const knownPositive = ['v4-nami-jocelyn-2', 'v5-nami-tomb'];
const freshPositive = ['v6-source-41897363'];
const negativeTrials = [
  ['plain-prints', ['v5-plain-print-a', 'v5-plain-print-b']],
  ['simulated-paper-and-screen', ['v6-paper-ferry', 'v6-screen-tomb']],
  ['other-ferry-and-tomb', ['v6-source-172419971', 'v6-source-13283679']],
];
const sameIds = (actual, expected) => actual.length === expected.length
  && actual.every((id, index) => id === expected[index]);

function assembleVisualEpisode(photos, matches, features, captureEvidence = new Map()) {
  const { qualifyVisualTrip, associateVisualAlbum } = loadTripRecovery();
  const observations = photos.flatMap(({ evidence_id: id }) => {
    const match = matches.get(id);
    if (match.reason === 'REPRODUCTION_MATCH') return [];
    if (captureEvidence.has(id)) {
      const evidence = captureEvidence.get(id);
      // Host evidence keeps its own basis in the report. The production
      // assembler consumes only qualified place observations.
      return evidence ? [{ id, placeId: evidence.placeId, kind: 'image' }] : [];
    }
    return [{ id, placeId: match.place, kind: match.place ? 'image' : null, embedding: features.get(id)[0] }];
  });
  const trip = qualifyVisualTrip(photos, observations);
  return trip ? associateVisualAlbum(trip) : null;
}

function buildPartialProposal(photos, matches, features, evidence) {
  const byId = new Map(photos.map(({ evidence_id, source_origin }) => [evidence_id, source_origin]));
  const pending = evidence.clues.filter(({ id, status }) => status === 'pending' && byId.has(id) && matches.has(id)
    && (byId.get(id) == null || byId.get(id) === 'capture-like') && matches.get(id).reason !== 'REPRODUCTION_MATCH');
  const captureEvidence = new Map(evidence.observations);
  for (const { id } of pending) {
    if (!captureEvidence.has(id)) captureEvidence.set(id, null);
  }
  const album = assembleVisualEpisode(photos, matches, features, captureEvidence);
  if (!album) return null;
  const stops = new Set(album.stops.map(({ placeId }) => placeId));
  const pendingClues = [...new Set(pending.map(({ placeId }) => placeId))].filter((id) => !stops.has(id));
  return { album, pendingClues };
}

function compareCaptureEpisodes(fixture, sampleEpisode, matches, features) {
  const { assessCaptureEvidence, captureEvidencePolicyVersion } = require('./offline-capture-evidence.cjs');
  const { target, maximumDistanceMeters, maximumAccuracyMeters } = fixture;
  const cases = fixture.cases.map((scenario) => {
    const samples = sampleEpisode(scenario.photos, { retainCaptureRecords: Object.keys(scenario.records), followUp: true });
    const byId = new Map(samples.representatives.map((photo) => [photo.evidence_id, photo]));
    const captureRecords = Object.entries(scenario.records).map(([id, profile]) => {
      const photo = byId.get(id);
      const coordinate = fixture.captureProfiles[profile];
      input.requireCondition(photo && coordinate, 'INPUT_INTEGRITY');
      return {
        evidenceId: 'gps-' + id, assetId: id, captureFamily: photo.family,
        observedAtMillis: photo.captured_at_millis, kind: 'original-camera-gps', ...coordinate,
      };
    });
    const evidence = assessCaptureEvidence({
      photos: samples.representatives, matches, captureRecords, target, maximumDistanceMeters, maximumAccuracyMeters,
    });
    const expectedIds = [...anchorIds.slice(0, 2), ...scenario.expectedTargetMembers, ...anchorIds.slice(2)];
    const expectedStops = scenario.expectedTargetMembers.length
      ? [mapping.ewha, mapping.nami, mapping.namsan] : [mapping.ewha, mapping.namsan];
    const expectedSupport = [anchorIds.slice(0, 2), anchorIds.slice(2)];
    if (scenario.expectedTargetMembers.length) expectedSupport.splice(1, 0, scenario.expectedTargetMembers);
    const summarize = (album) => {
      const stops = album?.stops.map(({ placeId }) => placeId) ?? [];
      const albumIds = album?.membership.map(({ id }) => id) ?? [];
      const support = album?.stops.map(({ supportIds }) => supportIds) ?? [];
      const expectedMembershipPlace = new Map(expectedStops.flatMap((place, index) =>
        expectedSupport[index].map((id) => [id, place])));
      const exact = sameIds(stops, expectedStops) && sameIds(albumIds, expectedIds)
        && support.every((ids, index) => sameIds(ids, expectedSupport[index]))
        && album.membership.every(({ id, placeId }) => expectedMembershipPlace.get(id) === placeId);
      return { stops, support, albumIds, exact };
    };
    const visualOnly = summarize(assembleVisualEpisode(samples.representatives, matches, features));
    const captureGated = summarize(assembleVisualEpisode(samples.representatives, matches, features, evidence.observations));
    const expectedClues = scenario.expectedClues;
    const cluesExact = sameIds(evidence.privateClues.map(({ id }) => id), expectedClues)
      && evidence.privateClues.every(({ placeId }) => placeId === target.id);
    const captureDecisions = [...evidence.observations].map(([id, decision]) => ({ id, decision }));
    const expectedPromotions = scenario.expectedCaptureEligible;
    const promotions = evidence.privateClues.filter(({ status }) => status === 'capture-eligible').map(({ id }) => id);
    const excluded = scenario.mustExcludeFromAlbum ?? [];
    const uniqueLocatedFamilies = new Set(captureDecisions.filter(({ decision }) => decision)
      .map(({ id }) => byId.get(id).family)).size;
    return {
      id: scenario.id, expectedStops, expectedAlbumIds: expectedIds, expectedClues, privateClues: evidence.privateClues,
      expectedCaptureEligible: expectedPromotions, captureDecisions, uniqueLocatedFamilies, cluesExact,
      clueStatusExact: sameIds(promotions, expectedPromotions),
      visualOnly, captureGated, allControlsSampled: scenario.photos.every((id) => byId.has(id)),
      excludedTargetStayedOut: excluded.every((id) => byId.has(id) && !captureGated.albumIds.includes(id)),
    };
  });
  return {
    version: fixture.version, policyVersion: captureEvidencePolicyVersion, fixtureSha256: captureFixturePin,
    sampleDesign: 'shared-representatives-with-fixture-capture-rows', cases,
    cluesExact: cases.filter(({ cluesExact }) => cluesExact).length,
    clueStatusesExact: cases.filter(({ clueStatusExact }) => clueStatusExact).length,
    visualExact: cases.filter(({ visualOnly }) => visualOnly.exact).length,
    captureExact: cases.filter(({ captureGated, excludedTargetStayedOut, allControlsSampled }) =>
      captureGated.exact && excludedTargetStayedOut && allControlsSampled).length,
  };
}

function benchmarkOutcome(coverageReady, passesScoredCases, captureGatePassed) {
  if (!passesScoredCases || !captureGatePassed) return 'GATE_NOT_MET';
  return coverageReady ? null : 'COVERAGE_INCOMPLETE';
}

function compareMultiviewEpisodes(fixture, measurements, sampleEpisode, matches, features, comparePartial) {
  const { assessMultiview, classifyGeometry } = require('./offline-multiview-evidence.cjs');
  input.requireCondition(fixture.version === 1 && measurements.version === 1
    && measurements.fixtureSha256 === multiviewFixturePin
    && fixture.pairs.length === measurements.pairs.length, 'INPUT_INTEGRITY');
  const controls = Object.fromEntries(Object.entries(measurements.controls).map(([id, value]) => [id, classifyGeometry(value)]));
  const checksPassed = controls.nonplanar === 'distinct-view' && controls.planar === 'planar-match'
    && controls.unrelated === 'inconclusive';
  input.requireCondition(checksPassed, 'DESCRIPTOR_SCHEMA');
  const pairs = fixture.pairs.map((pair, index) => {
    const measurement = measurements.pairs[index];
    input.requireCondition(pair.id === measurement.id && sameIds(pair.photos, measurement.photos), 'INPUT_INTEGRITY');
    const geometry = classifyGeometry(measurement);
    const result = { ...measurement, geometry, expectedGeometry: pair.expectedGeometry,
      geometryExact: geometry === pair.expectedGeometry };
    if (typeof pair.expectedTrip !== 'boolean') return result;
    const { representatives } = sampleEpisode(pair.photos);
    input.requireCondition(pair.photos.every((id) => representatives.some(({ evidence_id }) => id === evidence_id)),
      'INPUT_INTEGRITY');
    const evidence = assessMultiview(pair.photos, matches, mapping.nami, geometry);
    const expectedStops = pair.expectedTrip ? [mapping.ewha, mapping.nami, mapping.namsan] : [mapping.ewha, mapping.namsan];
    const expectedIds = pair.expectedTrip ? [...anchorIds.slice(0, 2), ...pair.photos, ...anchorIds.slice(2)] : anchorIds;
    const summarize = (album) => {
      const stops = album?.stops.map(({ placeId }) => placeId) ?? [];
      const members = album?.membership.map(({ id }) => id) ?? [];
      const hasTarget = stops.includes(mapping.nami);
      return { stops, members, hasTarget, exact: sameIds(stops, expectedStops) && sameIds(members, expectedIds) };
    };
    const partialProposal = comparePartial ? buildPartialProposal(representatives, matches, features, evidence) : undefined;
    return { ...result, expectedTrip: pair.expectedTrip, clues: evidence.clues,
      visualOnly: summarize(assembleVisualEpisode(representatives, matches, features)),
      multiview: summarize(assembleVisualEpisode(representatives, matches, features, evidence.observations)),
      partialProposal };
  });
  const episodes = pairs.filter(({ multiview }) => multiview);
  const gatePassed = pairs.every(({ geometryExact }) => geometryExact) && episodes.every(({ multiview }) => multiview.exact);
  return { controls, pairs, gatePassed, fixtureSha256: multiviewFixturePin, measurementsSha256: multiviewMeasurementsPin };
}

function compareIndependentMembership(multiview, sampleEpisode, matches, features) {
  const expectedPending = new Map([
    ['genuine-visit', [mapping.nami]],
    ['genuine-ride-with-copy', [mapping.nami]],
    ['other-ferry', [mapping.nami]],
    ['different-burial-site', []],
    ['known-copy-with-visit', [mapping.nami]],
  ]);
  const proposals = multiview.pairs.filter(({ id }) => expectedPending.has(id)).map(({ id, partialProposal }) => {
    const album = partialProposal?.album;
    const expectedClues = expectedPending.get(id);
    const exact = !!album && album.placeId === 'locality-seoul'
      && sameIds(album.stops.map(({ placeId }) => placeId), [mapping.ewha, mapping.namsan])
      && sameIds(album.stops[0].supportIds, anchorIds.slice(0, 2)) && sameIds(album.stops[1].supportIds, anchorIds.slice(2))
      && sameIds(album.coverIds, [anchorIds[0], anchorIds[2]])
      && sameIds(album.membership.map(({ id: assetId }) => assetId), anchorIds)
      && sameIds(partialProposal.pendingClues, expectedClues);
    return { id, exact, expectedClues, proposal: partialProposal };
  });
  const { representatives } = sampleEpisode([], { campusSceneProbe: true });
  const sceneId = 'v2-ewha-univ';
  input.requireCondition(representatives.some(({ evidence_id }) => evidence_id === sceneId), 'INPUT_INTEGRITY');
  const evidence = { observations: new Map(), clues: [] };
  const campus = buildPartialProposal(representatives, matches, features, evidence);
  const campusPhoto = campus?.album.membership.find(({ id }) => id === sceneId);
  const { scoreLandmarkEmbedding } = model.loadSource('visual-place/landmark-embedding.ts');
  const sceneMatches = anchorIds.slice(0, 2).map((id) => ({
    id, ...scoreLandmarkEmbedding(features.get(sceneId)[0], features.get(id)[0]),
  }));
  return {
    proposals, proposalsExact: proposals.length === expectedPending.size && proposals.every(({ exact }) => exact),
    campus: { proposal: campus, admittedAsScene: campusPhoto?.basis === 'scene', sceneMatches, sampled: true },
  };
}

async function main() {
  const start = performance.now();
  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort());
  const run = input.createRun((event) => process.stderr.write(JSON.stringify(event) + '\n'), abort.signal);
  const [inputDirectory, outputDirectory, comparison = 'frozen'] = process.argv.slice(2);
  const directory = await run.stage('SOURCE_READ', () => {
    input.requireCondition(inputDirectory && outputDirectory && process.argv.length <= 5
      && ['frozen', '0.55', '0.50', 'capture-evidence', 'multiview', 'partial-proposal'].includes(comparison));
    return path.resolve(inputDirectory);
  });
  const [v3, v1, fixture, priorHoldout, copies, captureFixture, multiviewFixture, multiviewMeasurements] = await run.stage('SOURCE_READ', () => [
    manifest('public-detail-v3', 'b9f50daad8e6ddc0399d9d48de101fb1a1c4a6d2d6751530438de0db8b32a176'),
    manifest('public-benchmark-v1', '608dfb2647fe01cd4dbec2432fe86ed5c633ca5287043d4d517d8f4019952b8e'),
    input.parseJson(input.readPinned(path.join(root, 'evals/landmarks/nami-visual-v1.json'), fixturePin)),
    input.parseJson(input.readPinned(path.join(root, 'evals/landmarks/nami-holdout-v1.json'), '9734e1bcaa8f7d7823e008b3b34ac122ff86eb907628ae11e144e197a1349073')),
    input.parseJson(input.readPinned(path.join(directory, 'nami-visual-copy-report.json'), '6fe5f7457509803b012e91d1dca1d8ffd48e760101c1e37a91c68e089435fe22')),
    comparison === 'capture-evidence'
      ? input.parseJson(input.readPinned(path.join(root, 'evals/landmarks/nami-capture-evidence-v1.json'), captureFixturePin)) : null,
    ['multiview', 'partial-proposal'].includes(comparison)
      ? input.parseJson(input.readPinned(path.join(root, 'evals/landmarks/nami-multiview-v1.json'), multiviewFixturePin)) : null,
    ['multiview', 'partial-proposal'].includes(comparison)
      ? input.parseJson(input.readPinned(path.join(directory, 'nami-multiview-measurements.json'), multiviewMeasurementsPin)) : null,
  ]);
  const { plan, config, references, counterexamples, photos } = await run.stage('REFERENCE_ADMISSION', () => {
    const ids = new Set(fixture.photos.map(({ id }) => id));
    input.requireCondition(ids.size === fixture.photos.length, 'INPUT_INTEGRITY');
    const allowedLicenses = new Set(['CC BY 2.0', 'CC BY 3.0', 'CC BY 4.0', 'CC BY-SA 2.0', 'CC BY-SA 3.0',
      'CC BY-SA 4.0', 'KOGL Type 1']);
    for (const row of fixture.photos) {
      if (row.role === 'query-reproduction') {
        input.requireCondition(row.sourcePhoto !== row.id && fixture.photos.some((parent) =>
          parent.id === row.sourcePhoto && parent.role !== 'query-reproduction'), 'INPUT_INTEGRITY');
      } else {
        input.requireCondition(row.author && allowedLicenses.has(row.license)
          && Number.isSafeInteger(row.sourceRevision) && row.sourceRevision > 0
          && row.sourcePage.startsWith('https://commons.wikimedia.org/')
          && /^https:\/\/(?:thumb|upload)\.wikimedia\.org\//u.test(row.downloadUrl), 'INPUT_INTEGRITY');
      }
    }
    const audit = input.auditSnapshot(v3, input.mapPlaces(v3.places));
    const supplemental = input.auditSnapshot(v1, input.mapPlaces(v1.places));
    const config = detail.parseDetailFixture(v3);
    const plan = detail.prepareDetailInputs(config, audit);
    const unique = new Map([...audit.references, ...audit.counterexamples, ...audit.queries, ...supplemental.queries]
      .map((row) => [row.id, row]));
    const previous = new Map(unique);
    for (const row of priorHoldout.photos) unique.set(row.id, { ...row, role: 'query' });
    for (const row of fixture.photos) {
      const role = row.role.startsWith('query') ? 'query' : row.role === 'competitor' ? 'counterexample' : row.role;
      const prior = unique.get(row.id);
      input.requireCondition(!prior || prior.sha256 === row.sha256, 'INPUT_INTEGRITY');
      const fresh = row.role === 'query-fresh' || row.role === 'query-negative';
      input.requireCondition(!fresh || !prior, 'INPUT_INTEGRITY');
      unique.set(row.id, { ...row, role });
    }
    input.requireCondition(new Set([...unique.values()].map(({ sha256 }) => sha256)).size === unique.size, 'INPUT_INTEGRITY');
    for (const row of fixture.photos.filter(({ role }) => role === 'query-fresh' || role === 'query-negative')) {
      const filename = (url) => url && decodeURIComponent(new URL(url).pathname).split('/').at(-1)
        .replace(/^\d+px-/u, '').toLowerCase();
      const source = filename(row.downloadUrl);
      input.requireCondition(source && ![...previous.values(), ...priorHoldout.photos]
        .some(({ downloadUrl }) => filename(downloadUrl) === source), 'INPUT_INTEGRITY');
    }
    return { plan, config, references: audit.references, counterexamples: audit.counterexamples, photos: [...unique.values()] };
  });
  const images = await run.stage('SOURCE_READ', () => input.readPublicImages(directory, photos));
  const { api, discovery } = await run.stage('MODEL_LOAD', () => ({
    api: model.loadSource('visual-place/landmark-embedding.ts'),
    discovery: model.loadSource('visual-place/discovery.ts'),
  }));
  const pixels = await run.stage('IMAGE_DECODE', () => model.decodeImages(images, photos, api.landmarkImageSize));
  images.clear();
  const runtime = await run.stage('MODEL_LOAD', () => model.loadDino(directory, v3.dinoModelSha256));
  const features = await run.stage('DESCRIPTOR_GENERATE', () =>
    model.extractDino(runtime, api, pixels, abort.signal, new Set(photos.map(({ id }) => id))));
  pixels.clear();

  const report = await run.stage('BENCHMARK_SCORE', async () => {
    const selectTemplates = (role) => fixture.photos.filter((row) => row.role === role)
      .map(({ id, subject }) => ({ id, subject, region: fixture.regions[id] }));
    const referenceTemplates = selectTemplates('reference');
    const competingTemplates = selectTemplates('competitor');
    const reproductionSources = referenceTemplates.map(({ id }) => id);
    const identicalSource = new Set(copies.filter((row) => row.possibleCopy).map(({ query }) => query));
    const policy = captureFixture || multiviewFixture ? '0.50' : comparison;
    const gates = policy === 'frozen' ? fixture.gates : { ...fixture.gates, minimumSimilarity: Number(policy) };
    const matcher = createNamiCorroborator({
      referenceTemplates, competingTemplates, reproductionSources, features, gates, signal: abort.signal,
    });
    const verifier = model.dinoVerifiedMatcher(api, features, counterexamples, v3.verification);
    const byId = new Map(photos.map((photo) => [photo.id, photo]));
    const isNamiTemplate = (id) => [...referenceTemplates, ...competingTemplates].some((template) => template.id === id);
    const interesting = new Set([...anchors.map(([id]) => id),
      ...fixture.photos.map(({ id }) => id), ...negativeTrials.flatMap(([, ids]) => ids),
      ...(captureFixture?.cases.flatMap(({ photos }) => photos) ?? []),
      ...(comparison === 'partial-proposal' ? ['v2-ewha-univ'] : []),
      'v5-ticket', 'v5-near-spelling', 'v5-damyang-lane', 'v5-nami-gate', 'v5-nami-stone-sign',
      'v5-nami-pavilion', 'v5-nami-trees-a', 'v5-nami-trees-b', 'v2-skytree-night']);
    const matches = new Map();
    for (const id of interesting) {
      if (isNamiTemplate(id)) continue;
      const photo = byId.get(id);
      input.requireCondition(photo, 'INPUT_INTEGRITY');
      const baseline = verifier.match(photo, references);
      const patch = features.get(id)[0].patches;
      const refScore = (row) => detail.bestLayoutSimilarity(patch, features.get(row.id)[0].patches, config.regions.get(row.id));
      const positive = Math.max(...plan.references.map(refScore));
      const competitor = Math.max(...plan.counterexamples.map(refScore));
      const namsan = positive >= config.minimumSimilarity && positive - competitor >= config.minimumMargin
        && (baseline === null || baseline === 'namsan');
      const textNominates = ['v5-plain-print-a', 'v5-plain-print-b', 'v5-ticket', 'v5-near-spelling'].includes(id);
      const assessment = matcher.match(photo, { textNominates });
      const nami = policy !== 'frozen' && identicalSource.has(id)
        ? { ...assessment, accepted: false, reason: 'REPRODUCTION_MATCH', subject: null } : assessment;
      const place = nami.accepted && !namsan && baseline !== 'ewha' ? mapping.nami
        : namsan && !nami.accepted ? mapping.namsan : baseline === 'ewha' && !nami.accepted ? mapping.ewha : null;
      matches.set(id, { id, baseline, place, ...nami,
        ...(nami.accepted && place !== mapping.nami ? { conflictingCandidate: mapping.nami } : {}) });
    }

    function sampleEpisode(ids, { crowded = false, retainCaptureRecords = [], followUp = crowded, campusSceneProbe = false } = {}) {
      const schedule = anchors.map(([id, time, origin]) => [id, id === 'v2-water-meter' && crowded ? '08:01' : time, origin]);
      if (campusSceneProbe) {
        schedule[0] = [anchorIds[0], '00:09'];
        schedule[1] = [anchorIds[1], '00:11'];
        schedule.push(['v2-ewha-univ', '00:10']);
      }
      const times = ids.length === 2 ? ['08:05', '08:15'] : ['08:09', '08:10', '08:11'];
      ids.forEach((id, index) => schedule.push([id, times[index]]));
      const all = buildRows(schedule).filter(({ source_origin }) => source_origin === 'capture-like');
      const anchored = new Set(retainCaptureRecords);
      const gpsless = all.filter(({ evidence_id }) => !anchored.has(evidence_id));
      const first = discovery.advanceVisualDiscovery(discovery.initialVisualDiscovery(), gpsless.slice(0, 4), false);
      const { next: retained } = discovery.advanceVisualDiscovery(first.next, gpsless.slice(4), false);
      const { candidate } = discovery.advanceVisualDiscovery(retained, [], true);
      assert.ok(candidate);
      const representatives = [...candidate.representatives];
      const firstIds = new Set(representatives.map(({ evidence_id }) => evidence_id));
      // The located branch joins its own intake after the GPS-less sampler.
      representatives.push(...all.filter(({ evidence_id }) => anchored.has(evidence_id)));
      if (campusSceneProbe) {
        // Supply a public photo to the follow-up seam under a synthetic clock.
        // This does not measure automatic selection of additional photos.
        const scene = retained.coverage.find(({ evidence_id }) => evidence_id === 'v2-ewha-univ');
        if (scene && !firstIds.has(scene.evidence_id)) representatives.push(scene);
      }
      if (followUp) {
        const singleton = representatives.find(({ evidence_id }) => matches.get(evidence_id)?.place === mapping.nami);
        if (singleton) {
          const missing = retained.coverage.filter(({ evidence_id, captured_at_millis }) => !firstIds.has(evidence_id)
            && Math.abs(captured_at_millis - singleton.captured_at_millis) < 90 * 60_000).slice(0, 4);
          representatives.push(...missing);
        }
      }
      return { representatives, firstPass: [...firstIds] };
    }
    async function trial(name, ids, options) {
      const { representatives, firstPass } = sampleEpisode(ids, options);
      const photoIds = representatives.map(({ evidence_id }) => evidence_id);
      const album = assembleVisualEpisode(representatives, matches, features);
      const membership = album?.membership.map(({ id }) => id) ?? [];
      const stops = album?.stops.map(({ placeId }) => placeId) ?? [];
      return { name, sampled: photoIds, firstPass, album, containsAnyTarget: ids.some((id) => membership.includes(id)),
        exactThreeStopAlbum: sameIds(stops, [mapping.ewha, mapping.nami, mapping.namsan])
          && sameIds(membership, [...anchorIds.slice(0, 2), ...ids, ...anchorIds.slice(2)]),
        exactTwoStopAlbum: sameIds(stops, [mapping.ewha, mapping.namsan]) && sameIds(membership, anchorIds) };
    }
    const episodes = [
      await trial('previously-seen-ferry-and-memorial', knownPositive),
      await trial('crowded-ferry-and-memorial', knownPositive, { crowded: true }),
      await trial('new-zipline-and-memorial', [...freshPositive, knownPositive[1]]),
      await trial('new-zipline-and-older-ferry', [...freshPositive, knownPositive[0]]),
      await trial('full-bleed-copy-and-real-zipline', ['v6-full-bleed-unindexed-ferry', freshPositive[0]]),
      ...await (async () => {
        const results = [];
        for (const [name, ids] of negativeTrials) results.push(await trial(name, ids));
        return results;
      })(),
    ];
    const negatives = [...matches.values()].filter(({ id }) => fixture.photos.some((row) => row.id === id
      && ['query-reproduction', 'query-negative'].includes(row.role))
      || ['v5-plain-print-a', 'v5-plain-print-b', 'v5-ticket', 'v5-near-spelling', 'control-damyang'].includes(id));
    const freshAccepted = freshPositive.filter((id) => matches.get(id).place === mapping.nami).length;
    const negativeAccepts = negatives.filter(({ place }) => place === mapping.nami).length;
    const referenceSubjects = new Set(referenceTemplates.map(({ subject }) => subject));
    const competingSubjects = new Set(competingTemplates.map(({ subject }) => subject));
    const coverageReady = new Set(fixture.photos.filter(({ role }) => role === 'query-fresh').map(({ author }) => author)).size >= 2
      && [...referenceSubjects].every((subject) => competingSubjects.has(subject));
    const passesScoredCases = freshAccepted === freshPositive.length && negativeAccepts === 0 && episodes.slice(0, 4).some(({ exactThreeStopAlbum }) => exactThreeStopAlbum)
      && episodes.slice(4).every(({ exactTwoStopAlbum }) => exactTwoStopAlbum);
    const priorPositives = fixture.photos.filter(({ role }) => role === 'query-regression');
    const priorAccepted = priorPositives.filter(({ id }) => matches.get(id).place === mapping.nami).length;
    const reproductionResults = fixture.photos.filter(({ role }) => role === 'query-reproduction')
      .map(({ id }) => ({ id, identifiedSource: identicalSource.has(id), falseAccept: matches.get(id).place === mapping.nami }));
    const captureComparison = captureFixture ? compareCaptureEpisodes(captureFixture, sampleEpisode, matches, features) : null;
    const comparePartial = comparison === 'partial-proposal';
    const multiviewComparison = multiviewFixture
      ? compareMultiviewEpisodes(multiviewFixture, multiviewMeasurements, sampleEpisode, matches, features, comparePartial) : null;
    const partialComparison = comparePartial ? compareIndependentMembership(multiviewComparison, sampleEpisode, matches, features) : null;
    const caseCount = captureComparison?.cases.length;
    const captureGatePassed = !captureComparison || captureComparison.captureExact === caseCount
      && captureComparison.cluesExact === caseCount && captureComparison.clueStatusesExact === caseCount;
    const outcome = benchmarkOutcome(coverageReady, passesScoredCases, captureGatePassed
      && (multiviewComparison?.gatePassed ?? true) && (partialComparison?.proposalsExact ?? true));
    return { matcherVersion, policy, gatePassed: outcome === null, outcome,
      captureGatePassed, priorAccepted, priorCount: priorPositives.length,
      reproductionResults, detectedSourceCopies: [...identicalSource], manifestSha256: fixturePin,
      modelSha256: v3.dinoModelSha256, thresholds: gates, coverageReady, passesScoredCases, freshAccepted,
      freshCount: freshPositive.length, negativeAccepts, negativeCount: negatives.length, matches: [...matches.values()], episodes,
      captureComparison, multiviewComparison, partialComparison };
  });
  report.hostMillis = Math.round(performance.now() - start);
  report.hostPeakRssBytes = process.resourceUsage().maxRSS * 1024;
  const destination = path.resolve(outputDirectory);
  await run.stage('ARTIFACT_WRITE', () => publishArtifacts(destination, [], report));
  if (report.outcome) run.outcome('BENCHMARK_SCORE', report.outcome);
  if (!report.gatePassed) process.exitCode = 1;
}

if (require.main === module) main().catch(() => { process.exitCode = 2; });

module.exports = { assembleVisualEpisode, benchmarkOutcome, buildPartialProposal };
