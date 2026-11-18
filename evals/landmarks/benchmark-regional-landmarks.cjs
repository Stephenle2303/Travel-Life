'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { registerHooks, stripTypeScriptTypes } = require('node:module');
const { performance } = require('node:perf_hooks');
const input = require('../../apps/mobile/scripts/offline-landmark-input.cjs');
const model = require('../../apps/mobile/scripts/offline-landmark-model.cjs');
const artifacts = require('../../apps/mobile/scripts/offline-landmark-benchmark.cjs');
const detail = require('../../apps/mobile/scripts/offline-landmark-details.cjs');

const sourceRoot = path.resolve(__dirname, '../../apps/mobile/src');
const sourceUrl = pathToFileURL(sourceRoot + path.sep).href;
const configName = 'public-regional-v1.json';
const queryCrops = [[0, 0], [0.35, 0], [0, 0.35], [0.35, 0.35], [0.175, 0.175]]
  .map(([x, y]) => ({ x, y, width: 0.65, height: 0.65 }));

function loadVisualModules() {
  const hooks = registerHooks({
    resolve(request, context, next) {
      if (context.parentURL?.startsWith(sourceUrl)) {
        if (request.startsWith('@/')) return next(new URL(request.slice(2) + '.ts', sourceUrl).href, context);
        if (request.startsWith('.') && !path.extname(request)) return next(new URL(request + '.ts', context.parentURL).href, context);
      }
      return next(request, context);
    },
    load(url, context, next) {
      if (!url.startsWith(sourceUrl) || !url.endsWith('.ts')) return next(url, context);
      const source = fs.readFileSync(fileURLToPath(url), 'utf8');
      return { format: 'module', shortCircuit: true, source: stripTypeScriptTypes(source, { mode: 'transform' }) };
    },
  });
  try {
    return Object.assign({}, ...['discovery', 'trip-recovery', 'landmark-embedding', 'place-catalog', 'regional-landmarks']
      .map((file) => model.loadSource(`visual-place/${file}.ts`)));
  } finally {
    hooks.deregister();
  }
}

function readFixture(config, parents) {
  const { starter, deepOnly } = config.references;
  const referenceIds = [...starter, ...deepOnly];
  input.requireCondition(new Set(referenceIds).size === referenceIds.length, 'INPUT_INTEGRITY');
  const referenceChoices = new Map(parents.flatMap(({ photos }) => photos.map((photo) => [photo.id, photo])));
  const references = referenceIds.map((id) => {
    const photo = referenceChoices.get(id);
    input.requireCondition(photo?.role === 'reference' && photo.review === 'approved', 'INPUT_INTEGRITY');
    return { ...photo, starter: starter.includes(id) };
  });
  const freshQueries = config.queryPhotos.map((photo) => ({ ...photo, source: 'commons', role: 'query', review: 'approved' }));
  const queriesById = new Map([...referenceChoices.values(), ...freshQueries].map((photo) => [photo.id, photo]));
  const queryIds = [...new Set(config.episodes.flatMap(({ sessions }) => sessions.flat()))];
  const queries = queryIds.map((id) => {
    const photo = queriesById.get(id);
    input.requireCondition(photo?.role === 'query' && photo.review === 'approved', 'INPUT_INTEGRITY');
    return photo;
  });
  input.requireCondition(freshQueries.every((photo) => queryIds.includes(photo.id)
    && parents.every((parent) => !parent.photos.some(({ sha256, captureGroup }) => sha256 === photo.sha256 || captureGroup === photo.captureGroup))), 'INPUT_INTEGRITY');
  const usedPlaces = new Set(references.map(({ placeId }) => placeId));
  const raw = { ...config, places: parents[0].places.filter(({ id }) => usedPlaces.has(id)), photos: [...references, ...queries],
    dinoModelSha256: parents[0].dinoModelSha256, saladModelSha256: null };
  const manifest = input.parseManifest(Buffer.from(JSON.stringify(raw)));
  const places = input.mapPlaces(manifest.places);
  const audit = input.auditSnapshot(manifest, places);
  input.requireCondition(audit.references.length === references.length && audit.queries.length === queries.length, 'INPUT_INTEGRITY');
  return { manifest, places, audit, queriesById };
}

function createSamples(api, episode, queriesById, features) {
  // Straddle adjacent production buckets so a camera negative and both
  // independent landmark captures are sampled in the same session.
  const minuteOffsets = [0, 4, 15];
  const rows = episode.sessions.flatMap((ids, session) => ids.map((id, index) => ({
    evidence_id: id, family: queriesById.get(id).captureGroup, source_ref: id, source_origin: queriesById.get(id).control === 'screenshot'
      ? 'screenshot' : 'capture-like', captured_day: '2025-11-04', captured_at_millis: Date.UTC(2025, 10, 4, 7 + session * 8, 50 + minuteOffsets[index]),
  }))).reverse();
  const captureRows = rows.filter(({ source_origin }) => source_origin === 'capture-like');
  const { candidate } = api.advanceVisualDiscovery(api.initialVisualDiscovery(), captureRows, true);
  input.requireCondition(candidate && captureRows.every(({ evidence_id }) =>
    candidate.representatives.some((photo) => photo.evidence_id === evidence_id)), 'INPUT_INTEGRITY');
  const samples = candidate.representatives
    .map(({ evidence_id: id, family, captured_at_millis: capturedAtMillis }) => ({ id, family, capturedAtMillis, embedding: features.get(id)[0] }));
  return { samples, representatives: candidate.representatives };
}

function equal(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function scoreProposal(api, episode, representatives, samples, matches, route) {
  const observations = samples.flatMap(({ id, embedding }) => {
    const hit = matches.get(id);
    if (hit === 'ambiguous') return [];
    return [{ id, embedding, placeId: hit?.placeId ?? null, kind: hit ? 'image' : null }];
  });
  const trip = api.qualifyVisualTrip(representatives, observations);
  const proposal = trip && api.associateVisualAlbum(trip);
  const stops = proposal?.stops.map(({ placeId }) => placeId) ?? [];
  const album = proposal?.membership.map(({ id }) => id) ?? [];
  const covers = proposal?.coverIds ?? [];
  const destination = proposal?.placeId ?? null;
  const exact = route === episode.country && destination === episode.destination && equal(stops, episode.stops)
    && equal(album, episode.album) && equal(covers, episode.covers)
    && equal(proposal?.stops.map(({ supportIds }) => supportIds) ?? [], episode.support);
  return { route, destination, stops, covers, album, exact, attempts: samples.length,
    matches: samples.map(({ id }) => ({ id, placeId: matches.get(id)?.placeId ?? null })),
    missingMembers: episode.album.filter((id) => !album.includes(id)), wrongMembers: album.filter((id) => !episode.album.includes(id)),
  };
}

function selectQueryViews(api, samples, pack, features) {
  return samples.map((sample) => {
    const classify = (embedding) => api.searchRegionalLandmarks([{ ...sample, embedding }], pack).matches.get(sample.id);
    if (classify(sample.embedding) !== null) return sample;
    const agreeing = [];
    for (const embedding of features.get(sample.id).slice(1)) {
      const hit = classify(embedding);
      if (hit === 'ambiguous' || (hit && agreeing.some((view) => view.hit.placeId !== hit.placeId))) return sample;
      if (hit) agreeing.push({ embedding, hit });
    }
    return agreeing.length >= 2 ? { ...sample, embedding: agreeing[0].embedding } : sample;
  });
}

function applyDetailTemplates(api, samples, matches, route, plan, features, signal) {
  if (!route || !plan) return matches;
  const templates = plan.filter(({ country }) => country === route);
  if (!templates.length) return matches;
  const merged = new Map(matches);
  for (const { id } of samples) {
    if (matches.get(id) !== null) continue;
    const query = features.get(id)[0].patches;
    input.requireCondition(query, 'DESCRIPTOR_SCHEMA');
    const hits = templates.filter(({ config, references, counterexamples }) => {
      const scores = ({ id: templateId }) => {
        if (signal.aborted) throw new input.LandmarkBuildError('CANCELLED');
        const reference = features.get(templateId)?.[0]?.patches;
        input.requireCondition(reference, 'DESCRIPTOR_SCHEMA');
        return detail.bestLayoutSimilarity(query, reference, config.regions.get(templateId));
      };
      const strongest = Math.max(...references.map(scores));
      return strongest >= config.minimumSimilarity && strongest - Math.max(...counterexamples.map(scores)) >= config.minimumMargin;
    });
    if (hits.length === 1) merged.set(id, { placeId: api.resolveRegionalLandmarkId(hits[0].config.targetPlaceId).id, country: route });
    if (hits.length > 1) merged.set(id, 'ambiguous');
  }
  return merged;
}

function compare(api, config, fixture, parsed, features, signal, templatePlan) {
  const baseline = require('../../apps/mobile/src/visual-place/data/ewha-campus-embeddings.json');
  const starter = parsed.get('starter');
  const expectedPlace = (id) => api.resolveRegionalLandmarkId(fixture.queriesById.get(id).placeId)?.id ?? null;
  return config.episodes.map((expected) => {
    if (signal.aborted) throw new input.LandmarkBuildError('CANCELLED');
    const episode = { ...expected, support: expected.stops.map((place) => expected.album.filter((id) => expectedPlace(id) === place)) };
    const { samples, representatives } = createSamples(api, episode, fixture.queriesById, features);
    const current = new Map(samples.map(({ id, embedding }) => [id, baseline.some(({ embedding: ref, kind }) => api.matchesLandmarkEmbedding(embedding, ref, kind))
      ? { placeId: 'ewha-womans-university', country: 'KR' } : null]));
    const first = api.searchRegionalLandmarks(samples, starter);
    const deep = first.route ? parsed.get(first.route.toLowerCase()) : undefined;
    const regional = deep ? api.finishRegionalLandmarkSearch(samples, first, deep) : first.matches;
    const knownCountryPack = episode.country && parsed.get(episode.country.toLowerCase());
    const knownCountry = knownCountryPack && api.searchRegionalLandmarks(samples, knownCountryPack).matches;
    let diverseViews = null;
    let viewAndDetail = null;
    let withKnownCountryViews = null;
    if (features.get(samples[0].id).length > 1) {
      const starterViews = selectQueryViews(api, samples, starter, features);
      const routed = api.searchRegionalLandmarks(starterViews, starter);
      const selectedPack = routed.route ? parsed.get(routed.route.toLowerCase()) : null;
      const results = selectedPack
        ? api.finishRegionalLandmarkSearch(selectQueryViews(api, samples, selectedPack, features), routed, selectedPack)
        : routed.matches;
      diverseViews = scoreProposal(api, episode, representatives, samples, results, routed.route);
      if (templatePlan) viewAndDetail = scoreProposal(api, episode, representatives, samples,
        applyDetailTemplates(api, samples, results, routed.route, templatePlan, features, signal), routed.route);
      if (knownCountryPack) {
        const knownViews = selectQueryViews(api, samples, knownCountryPack, features);
        const search = api.searchRegionalLandmarks(knownViews, knownCountryPack);
        withKnownCountryViews = scoreProposal(api, episode, representatives, samples,
          applyDetailTemplates(api, samples, search.matches, episode.country, templatePlan, features, signal), episode.country);
      }
    }
    return { id: episode.id, expectedCountry: episode.country, conflict: first.conflict,
      expectedStops: episode.stops,
      current: scoreProposal(api, episode, representatives, samples, current, null),
      starter: scoreProposal(api, episode, representatives, samples, first.matches, first.route),
      regional: scoreProposal(api, episode, representatives, samples, regional, first.route),
      withKnownCountry: knownCountry ? scoreProposal(api, episode, representatives, samples, knownCountry, episode.country) : null,
      diverseViews, viewAndDetail, withKnownCountryViews,
    };
  });
}

function scorePhotoRecognition(api, results, policy, queriesById) {
  const counts = { attempts: 0, correct: 0, wrong: 0, missed: 0, trueNegative: 0 };
  const falseControlMatches = new Set();
  for (const item of results) {
    for (const { id, placeId } of item[policy]?.matches ?? []) {
      counts.attempts++;
      const expected = api.resolveRegionalLandmarkId(queriesById.get(id).placeId)?.id ?? null;
      if (placeId && placeId === expected) counts.correct++;
      else if (placeId) {
        counts.wrong++;
        if (!expected) falseControlMatches.add(id);
      } else if (expected) counts.missed++;
      else counts.trueNegative++;
    }
  }
  return { ...counts, wrongRate: counts.attempts ? counts.wrong / counts.attempts : null, falseControlMatches: [...falseControlMatches] };
}

async function runRegionalBenchmark(options, writeEvent, signal) {
  const run = input.createRun(writeEvent, signal);
  const start = performance.now();
  const bytes = await run.stage('SOURCE_READ', () => {
    input.requireCondition(options.directory && options.output && /^[a-f0-9]{64}$/.test(options.fixtureHash) && !options.invalid);
    return input.readPinned(path.join(__dirname, configName), options.fixtureHash);
  });
  let config = await run.stage('SOURCE_PARSE', () => {
    const value = input.parseJson(bytes);
    input.requireCondition(value.version === 1 && value.parents?.length === 2 && value.episodes?.length === 4);
    return value;
  });
  if (options.holdoutHash) {
    const holdoutBytes = await run.stage('SOURCE_READ', () => input.readPinned(path.join(__dirname, 'public-regional-hanoi-holdout-v1.json'),
      options.holdoutHash));
    config = await run.stage('SOURCE_PARSE', () => {
      const holdout = input.parseJson(holdoutBytes);
      input.requireCondition(holdout.version === 1 && holdout.baseSha256 === options.fixtureHash
        && holdout.episode?.id === 'hanoi-holdout' && holdout.queryPhotos?.length === 4
        && holdout.queryPhotos.every((query) => !config.queryPhotos.some(({ id, author, captureGroup, sha256 }) =>
          id === query.id || author === query.author || captureGroup === query.captureGroup || sha256 === query.sha256)));
      return { ...config, queryPhotos: [...config.queryPhotos, ...holdout.queryPhotos], episodes: [...config.episodes, holdout.episode] };
    });
  }
  const parents = await run.stage('SOURCE_READ', () => config.parents.map(({ file, sha256 }) => {
    input.requireCondition(['public-benchmark-v1.json', 'public-detail-v3.json'].includes(file));
    return input.parseManifest(input.readPinned(path.join(__dirname, file), sha256));
  }));
  const fixture = await run.stage('REFERENCE_ADMISSION', () => readFixture(config, parents));
  const photos = [...fixture.audit.references, ...fixture.audit.queries];
  const templatePlan = options.compareViews ? await run.stage('REFERENCE_ADMISSION', () => parents.filter(({ detail }) => detail)
    .map((parent) => {
      const config = detail.parseDetailFixture(parent);
      const places = input.mapPlaces(parent.places);
      const plan = detail.prepareDetailInputs(config, input.auditSnapshot(parent, places));
      input.requireCondition(plan.ready && plan.references.every(({ id }) => photos.some((photo) => photo.id === id)), 'INPUT_INTEGRITY');
      return { config, references: plan.references, counterexamples: plan.counterexamples, country: places.get(config.targetPlaceId).region.slice(0, 2) };
    })) : null;
  const patchPhotoIds = templatePlan && new Set([...fixture.audit.queries, ...templatePlan.flatMap(({ references, counterexamples }) =>
    [...references, ...counterexamples])].map(({ id }) => id));
  if (templatePlan) photos.push(...templatePlan.flatMap(({ counterexamples }) => counterexamples));
  const images = await run.stage('SOURCE_READ', () => input.readPublicImages(options.directory, photos));
  const api = await run.stage('MODEL_LOAD', loadVisualModules);
  const scanStart = performance.now();
  const pixels = await run.stage('IMAGE_DECODE', () => model.decodeImages(images, photos, api.landmarkImageSize, undefined,
    options.compareViews ? queryCrops : []));
  images.clear();
  const runtime = await run.stage('MODEL_LOAD', () => model.loadDino(options.directory, fixture.manifest.dinoModelSha256));
  const features = await run.stage('DESCRIPTOR_GENERATE', () => model.extractDino(runtime, api, pixels, signal, patchPhotoIds));
  pixels.clear();
  const packs = await run.stage('ARTIFACT_VERIFY', () => {
    const result = artifacts.buildArtifacts(model.dinoMatcher(api, features), fixture.manifest, options.fixtureHash,
      fixture.audit.references, fixture.places, fixture.audit.coverage);
    artifacts.verifyArtifacts(result);
    return result;
  });
  const parsed = await run.stage('ARTIFACT_VERIFY', () => new Map(packs.map(({ artifact, manifest }) =>
    [manifest.packId, api.parseRegionalLandmarkPack(JSON.parse(artifact), manifest.packId)])));
  const scoreStart = performance.now();
  const results = await run.stage('BENCHMARK_SCORE', () => compare(api, config, fixture, parsed, features, signal, templatePlan));
  const hostMillis = performance.now() - scoreStart;
  const hostPipelineMillis = performance.now() - scanStart;
  const hostPeakRssBytes = process.resourceUsage().maxRSS * 1024;
  const photoRecognition = scorePhotoRecognition(api, results, 'regional', fixture.queriesById);
  const experimentalPhotoRecognition = options.compareViews ? scorePhotoRecognition(api, results, 'viewAndDetail', fixture.queriesById) : null;
  const countStops = (policy) => results.reduce((count, result) => count
    + result[policy].stops.filter((id) => result.expectedStops.includes(id)).length, 0);
  const correctStopGain = countStops('regional') - countStops('current');
  const release = Buffer.from(JSON.stringify({ version: 1, qualified: true, packs: packs.map(({ manifest }) => manifest) }) + '\n');
  const starter = packs.find(({ manifest }) => manifest.packId === 'starter');
  const largestDeep = Math.max(...packs.filter(({ manifest }) => manifest.packId !== 'starter').map(({ manifest }) => manifest.size));
  const packWorkingSetBytes = release.length + starter.manifest.size + largestDeep;
  const checks = {
    exactEpisodes: results.every(({ regional }) => regional.exact),
    correctStopGain: correctStopGain >= config.gates.minimumStopGain,
    photoRecognition: photoRecognition.wrongRate !== null && photoRecognition.wrongRate <= config.gates.maximumFalseMatchRate,
    packWorkingSet: packWorkingSetBytes <= config.gates.maximumPackBytes,
    hostPipeline: hostPipelineMillis <= config.gates.maximumScanMillis,
    hostPeakRss: hostPeakRssBytes <= config.gates.maximumPeakMemoryBytes,
  };
  const gatePassed = Object.values(checks).every(Boolean);
  const activationEligible = gatePassed && !options.compareViews;
  const publishable = activationEligible ? [...packs, { filename: 'regional-landmarks-v1', artifact: release,
    manifest: { version: 1, sha256: input.sha256(release) } }] : [];
  const report = { version: 1, id: config.id, manifestSha256: options.fixtureHash, gatePassed,
    comparedQueryViews: options.compareViews ? queryCrops.length + 1 : 1,
    holdoutManifestSha256: options.holdoutHash ?? null,
    releaseManifestSha256: activationEligible ? input.sha256(release) : null, hostEvaluationMillis: Math.round(hostMillis),
    hostPipelineMillis: Math.round(hostPipelineMillis), packWorkingSetBytes, checks,
    hostMillisBeforePublication: Math.round(performance.now() - start), hostPeakRssBytes,
    correctStopGain, photoRecognition, experimentalPhotoRecognition, coverage: fixture.audit.coverage, results,
    packs: packs.map(({ manifest }) => ({ packId: manifest.packId, size: manifest.size })),
  };
  await run.stage('ARTIFACT_WRITE', () => artifacts.publishArtifacts(options.output, publishable, report));
  if (!gatePassed) run.outcome('BENCHMARK_SCORE', 'GATE_NOT_MET');
  return report;
}

if (require.main === module) {
  const [directory, output, fixtureHash, mode, holdoutHash, ...extra] = process.argv.slice(2);
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  runRegionalBenchmark({ directory, output, fixtureHash, compareViews: mode === '--compare-views', holdoutHash,
    invalid: extra.length !== 0 || (mode !== undefined && mode !== '--compare-views') || (holdoutHash && !/^[a-f0-9]{64}$/.test(holdoutHash)) },
    (event) => process.stdout.write(JSON.stringify(event) + '\n'), controller.signal)
    .then((report) => { if (!report.gatePassed) process.exitCode = 1; })
    .catch((error) => { process.exitCode = error instanceof input.LandmarkBuildError && error.reasonCode === 'CANCELLED' ? 130 : 2; });
}

module.exports = { runRegionalBenchmark };
