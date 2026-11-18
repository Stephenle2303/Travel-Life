const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { LandmarkBuildError, requireCondition, requiredPlaces, sha256, dinoVerifierVersion } = require('./offline-landmark-input.cjs');

const json = (value) => Buffer.from(JSON.stringify(value) + '\n');
const countryOf = (place) => place.region.split('-')[0];
const compareId = (left, right) => left.id.localeCompare(right.id, 'en');

function prepareEpisodes(episodes = [], queries, placesById) {
  const queryById = new Map(queries.map((photo) => [photo.id, photo]));
  const ids = new Set();
  return episodes.map((episode) => {
    requireCondition(episode && typeof episode.id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(episode.id)
      && !ids.has(episode.id) && Array.isArray(episode.photos) && episode.photos.length >= 4 && episode.photos.length <= 500
      && Array.isArray(episode.expectedStops) && episode.expectedStops.length !== 1
      && new Set(episode.expectedStops).size === episode.expectedStops.length
      && episode.expectedStops.every((place) => placesById.has(place)));
    ids.add(episode.id);
    const photoIds = new Set();
    const rows = episode.photos.map((entry) => {
      requireCondition(entry && typeof entry === 'object');
      const { photoId, session, capturedAtMillis } = entry;
      const photo = queryById.get(photoId);
      requireCondition(photo && !photoIds.has(photoId) && typeof session === 'string'
        && /^[a-z0-9][a-z0-9-]{0,79}$/.test(session) && Number.isSafeInteger(capturedAtMillis)
        && capturedAtMillis >= 0 && capturedAtMillis < 253_402_300_800_000);
      photoIds.add(photoId);
      return { ...photo, session, capturedAtMillis };
    }).sort((left, right) => left.capturedAtMillis - right.capturedAtMillis || compareId(left, right));
    const observed = new Set(rows.flatMap((row) => row.placeId === null ? [] : [row.placeId]));
    requireCondition(observed.size === episode.expectedStops.length && episode.expectedStops.every((stop) => observed.has(stop)));
    const countries = new Set(episode.expectedStops.map((place) => countryOf(placesById.get(place))));
    requireCondition(countries.size <= 1);
    return { id: episode.id, rows, expectedStops: episode.expectedStops, country: countries.values().next().value ?? null };
  });
}

function fixedSample(discovery, rows, budget) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const candidates = [...rows].reverse().map((row) => ({
    captured_at_millis: row.capturedAtMillis, captured_day: new Date(row.capturedAtMillis).toISOString().slice(0, 10),
    evidence_id: row.id, family: row.captureGroup + ':' + row.author,
  }));
  const { candidate } = discovery.advanceVisualDiscovery(discovery.initialVisualDiscovery(), candidates, true);
  return (candidate?.representatives ?? []).slice(0, budget).map((row) => byId.get(row.evidence_id));
}

function progressiveSample(rows, limit, match) {
  const sessions = new Map();
  for (const row of rows) {
    const photos = sessions.get(row.session) ?? [];
    photos.push(row);
    sessions.set(row.session, photos);
  }
  const unresolved = [...sessions.values()].map((photos) => [...photos]);
  const resolved = [];
  let attempts = 0;
  while (attempts < limit && (unresolved.length || resolved.length)) {
    const source = unresolved.length ? unresolved : resolved;
    const photos = source.shift();
    const row = photos.shift();
    attempts += 1;
    const matched = match(row);
    if (photos.length) (matched || source === resolved ? resolved : unresolved).push(photos);
  }
  return attempts;
}

function divide(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function evaluateQueries(matcher, queries, references, signal) {
  const cases = [];
  const times = [];
  for (const photo of queries) {
    if (signal?.aborted) throw new LandmarkBuildError('CANCELLED');
    const start = performance.now();
    const actual = matcher.match(photo, references);
    times.push(performance.now() - start);
    cases.push({ expected: photo.placeId, actual, control: photo.control ?? null });
  }
  times.sort((left, right) => left - right);
  const positives = cases.filter((row) => row.expected !== null).length;
  const accepted = cases.filter((row) => row.actual !== null).length;
  const correct = cases.filter((row) => row.actual !== null && row.actual === row.expected).length;
  const falseMatches = accepted - correct;
  const negatives = cases.filter((row) => row.expected === null);
  const wrongNegativeMatches = negatives.filter((row) => row.actual !== null).length;
  return {
    count: cases.length, positives, negatives: negatives.length, accepted, correct, falseMatches,
    abstained: cases.length - accepted, precision: divide(correct, accepted), recall: divide(correct, positives),
    falseMatchRate: divide(falseMatches, cases.length), negativeFalseMatchRate: divide(wrongNegativeMatches, negatives.length),
    p50MatchMillis: times[Math.max(0, Math.ceil(times.length * 0.5) - 1)] ?? null,
    p95MatchMillis: times[Math.max(0, Math.ceil(times.length * 0.95) - 1)] ?? null,
    controls: Object.fromEntries([...new Set(negatives.map((row) => row.control))].sort().map((tag) => [
      tag, { count: negatives.filter((row) => row.control === tag).length,
        falseMatches: negatives.filter((row) => row.control === tag && row.actual !== null).length },
    ])),
  };
}

function evaluateEpisodes(matcher, references, starter, placesById, episodes, discovery, samplerBudget, policy, signal) {
  const summary = [];
  for (const episode of episodes) {
    const stops = new Set();
    const falseStops = new Set();
    const clues = new Map();
    let route = null;
    let routeAttempt = null;
    let attempts = 0;
    let falseMatches = 0;
    const start = performance.now();
    function match(row) {
      if (signal?.aborted) throw new LandmarkBuildError('CANCELLED');
      attempts += 1;
      const eligible = policy === 'starter' ? starter : policy === 'routed'
        ? route ? references.filter((reference) => countryOf(placesById.get(reference.placeId)) === route) : starter
        : references;
      const place = matcher.match(row, eligible);
      if (place === null) return false;
      if (place === row.placeId) {
        stops.add(place);
      } else {
        falseMatches += 1;
        falseStops.add(place);
      }
      if (policy === 'routed' && route === null) {
        const country = countryOf(placesById.get(place));
        const groups = clues.get(country) ?? new Map();
        const author = row.author.normalize('NFKC').trim().toLowerCase();
        const independent = [...groups.values()].some((clue) => clue.session !== row.session && clue.author !== author);
        clues.set(country, groups);
        groups.set(row.id, { session: row.session, author });
        if (independent && clues.size === 1) {
          route = country;
          routeAttempt = attempts;
        }
      }
      return true;
    }
    const fixed = fixedSample(discovery, episode.rows, samplerBudget);
    if (policy === 'progressive') progressiveSample(episode.rows, fixed.length, match);
    else fixed.forEach(match);
    summary.push({ episodeId: episode.id, country: episode.country, attempts, commonBudget: fixed.length,
      correctStops: stops.size, expectedStops: episode.expectedStops.length, falseStops: falseStops.size, falseMatches,
      route, routeAttempt, matchMillis: performance.now() - start });
  }
  const correctRoutes = summary.filter((row) => row.route !== null && row.route === row.country).length;
  const wrongRoutes = summary.filter((row) => row.route !== null && row.route !== row.country).length;
  const falseRoutes = summary.filter((row) => row.route !== null && row.country === null).length;
  const attempts = summary.reduce((sum, row) => sum + row.attempts, 0);
  return { episodes: summary, correctStops: summary.reduce((sum, row) => sum + row.correctStops, 0),
    falseStops: summary.reduce((sum, row) => sum + row.falseStops, 0),
    expectedStops: summary.reduce((sum, row) => sum + row.expectedStops, 0),
    falseMatchRate: divide(summary.reduce((sum, row) => sum + row.falseMatches, 0), attempts),
    correctRoutes, wrongRoutes, falseRoutes, unrouted: summary.length - correctRoutes - wrongRoutes,
    regionRoutingAccuracy: policy === 'routed' ? divide(correctRoutes, summary.filter((row) => row.country !== null).length) : null };
}

function serializeDescriptor(vector) {
  if (ArrayBuffer.isView(vector)) return Array.from(vector);
  return { global: Array.from(vector.global), pooled: Array.from(vector.pooled), regions: vector.regions.map((region) => Array.from(region)) };
}

function buildArtifacts(matcher, input, manifestHash, references, placesById, coverage) {
  const starter = references.filter((photo) => photo.starter);
  const countries = [...new Set(references.map((photo) => countryOf(placesById.get(photo.placeId))))].sort();
  return [['starter', starter], ...countries.map((country) => [
    country.toLowerCase(), references.filter((photo) => countryOf(placesById.get(photo.placeId)) === country),
  ])].map(([packId, rows]) => {
    const placeIds = new Set(rows.map((row) => row.placeId));
    const counterexamples = (matcher.counterexamples ?? []).filter((row) => placeIds.has(row.placeId));
    const attributions = [...rows, ...counterexamples].map(({ id, placeId, source, url, author, revision, sha256, license, restrictions, role, edition }) => ({
      id, placeId, source, url, author, revision, sha256, license, restrictions: restrictions ?? null,
      ...(edition ? { edition } : {}),
      ...(role === 'counterexample' ? { role } : {}),
    }));
    const publicPlaces = [...placeIds].sort().map((id) => placesById.get(id));
    const artifact = json({
      version: 1, packId, descriptorVersion: matcher.version, places: publicPlaces,
      ...(matcher.verification ? { verification: matcher.verification } : {}),
      descriptors: [...rows, ...counterexamples].map(({ id, placeId, kind, role }) => ({
        id, placeId, kind, ...(role === 'counterexample' ? { role } : {}), views: matcher.features.get(id).map(serializeDescriptor),
      })),
    });
    const countries = [...new Set(publicPlaces.map(countryOf))].sort();
    const manifest = {
      version: 1, snapshot: input.id, sourceManifestSha256: manifestHash, packId, countries,
      descriptorVersion: matcher.version, modelSha256: matcher.version.startsWith('salad-') ? input.saladModelSha256 : input.dinoModelSha256,
      ...(matcher.verification ? { verification: matcher.verification } : {}),
      size: artifact.length, sha256: sha256(artifact), attributions,
      coverage: coverage.filter((row) => publicPlaces.some((place) => place.id === row.placeId)),
    };
    return { filename: `${matcher.version}-${packId}`, artifact, manifest };
  });
}

function compareMatchers(input, audit, episodes, placesById, discovery, matchers, signal) {
  const starter = audit.references.filter((photo) => photo.starter);
  const samplerBudget = input.samplerBudget ?? 96;
  return Object.fromEntries(matchers.map((matcher) => [matcher.version, {
    starter: evaluateQueries(matcher, audit.queries, starter, signal),
    deep: evaluateQueries(matcher, audit.queries, audit.references, signal),
    fixed: evaluateEpisodes(matcher, audit.references, starter, placesById, episodes, discovery, samplerBudget, 'deep', signal),
    progressive: evaluateEpisodes(matcher, audit.references, starter, placesById, episodes, discovery, samplerBudget, 'progressive', signal),
    starterEpisodes: evaluateEpisodes(matcher, audit.references, starter, placesById, episodes, discovery, samplerBudget, 'starter', signal),
    routedEpisodes: evaluateEpisodes(matcher, audit.references, starter, placesById, episodes, discovery, samplerBudget, 'routed', signal),
  }]));
}

function assessGate(input, audit, episodes, scores, packs) {
  const [baseline, firstCandidate] = Object.values(scores);
  const candidate = input.verification ? scores[dinoVerifierVersion] : firstCandidate;
  const countries = new Set(episodes.map((episode) => episode.country).filter(Boolean));
  const koreaStops = new Set(episodes.filter((episode) => episode.country === 'KR').flatMap((episode) => episode.expectedStops));
  const matchedWork = episodes.every(({ id }) => {
    const results = [baseline?.fixed, baseline?.progressive, candidate?.fixed, candidate?.progressive, candidate?.routedEpisodes]
      .map((run) => run?.episodes.find((episode) => episode.episodeId === id));
    const work = results[0]?.attempts;
    return work > 0 && results.every((result) => result?.attempts === work && result.commonBudget === work);
  });
  const complete = audit.complete && countries.has('KR') && countries.size >= 2
    && requiredPlaces.every((place) => koreaStops.has(place)) && matchedWork
    && episodes.some((episode) => episode.country === null);
  const stopGain = candidate && baseline ? candidate.fixed.correctStops - baseline.fixed.correctStops : null;
  const routedStopGain = candidate && baseline
    ? candidate.routedEpisodes.correctStops - baseline.routedEpisodes.correctStops : null;
  const matchRates = [candidate?.starter, candidate?.deep, candidate?.fixed, candidate?.progressive,
    candidate?.starterEpisodes, candidate?.routedEpisodes].map((run) => run?.falseMatchRate);
  const falseMatchRate = matchRates.every(Number.isFinite) ? Math.max(...matchRates) : null;
  const candidatePacks = packs.filter((pack) => input.verification
    ? pack.manifest.descriptorVersion === dinoVerifierVersion
    : pack.manifest.descriptorVersion.startsWith('salad-'));
  const bytesOf = ({ manifest }) => manifest.size + json(manifest).length;
  const starterPack = candidatePacks.find((pack) => pack.manifest.packId === 'starter');
  const regionalBytes = candidatePacks.filter((pack) => pack.manifest.packId !== 'starter').map(bytesOf);
  const packBytes = starterPack && regionalBytes.length ? bytesOf(starterPack) + Math.max(...regionalBytes) : null;
  const checks = {
    coverage: Boolean(complete),
    stopGain: stopGain === null ? null : stopGain >= input.gates.minimumStopGain
      && routedStopGain >= input.gates.minimumStopGain,
    falseMatchRate: falseMatchRate === null ? null : falseMatchRate <= input.gates.maximumFalseMatchRate,
    packBytes: packBytes === null ? null : packBytes <= input.gates.maximumPackBytes,
    routing: candidate && countries.size ? candidate.routedEpisodes.regionRoutingAccuracy === 1
      && candidate.routedEpisodes.falseRoutes === 0 : null,
  };
  return {
    publicGate: Object.values(checks).every((passed) => passed === true) ? 'passed' : complete && candidate ? 'failed' : 'incomplete',
    checks, observed: { stopGain, routedStopGain, falseMatchRate, packBytes, androidScanMillis: null, androidPeakMemoryBytes: null },
    androidResourceGate: 'not_measured',
  };
}

function verifyArtifacts(packs) {
  const validVector = (value, length) => Array.isArray(value) && value.length === length
    && value.every(Number.isFinite) && value.some((entry) => entry !== 0);
  for (const { artifact, manifest } of packs) {
    requireCondition(artifact.length === manifest.size && sha256(artifact) === manifest.sha256, 'ARTIFACT_INTEGRITY');
    let data;
    try {
      data = JSON.parse(artifact);
    } catch {
      throw new LandmarkBuildError('ARTIFACT_INTEGRITY');
    }
    const salad = manifest.descriptorVersion.startsWith('salad-');
    const verified = manifest.descriptorVersion === dinoVerifierVersion;
    requireCondition(data?.version === manifest.version && data.packId === manifest.packId
      && data.descriptorVersion === manifest.descriptorVersion && Array.isArray(data.descriptors)
      && (verified ? Number.isFinite(data.verification?.margin) && data.verification.margin > 0
        && data.verification.margin < 1 && data.verification.margin === manifest.verification?.margin
        : data.verification === undefined && manifest.verification === undefined)
      && data.descriptors.length === manifest.attributions.length && data.descriptors.every((row, index) => {
        const attribution = manifest.attributions[index];
        if (attribution.id !== row?.id || attribution.placeId !== row.placeId || attribution.role !== row.role
          || (row.role !== undefined && (!verified || row.role !== 'counterexample'))
          || !Array.isArray(row.views) || row.views.length !== (salad ? 1 : 2)) return false;
        return row.views.every((view) => salad ? validVector(view, 8448)
          : validVector(view?.global, 384) && validVector(view.pooled, 384)
            && Array.isArray(view.regions) && view.regions.length === 16
            && view.regions.every((region) => validVector(region, 384)));
      }), 'ARTIFACT_INTEGRITY');
  }
}

function publishArtifacts(destination, packs, report, fileSystem = fs) {
  const target = path.resolve(destination);
  requireCondition(!fileSystem.existsSync(target), 'OUTPUT_EXISTS');
  const parent = path.dirname(target);
  let staging;
  const written = [];
  try {
    staging = fileSystem.mkdtempSync(path.join(parent, '.landmark-eval-'));
    const write = (filename, bytes) => {
      const file = path.join(staging, filename);
      written.push(file);
      fileSystem.writeFileSync(file, bytes, { flag: 'wx' });
      requireCondition(sha256(fileSystem.readFileSync(file)) === sha256(bytes), 'ARTIFACT_INTEGRITY');
    };
    for (const { filename, artifact, manifest } of packs) {
      write(`${filename}.json`, artifact);
      write(`${filename}.manifest.json`, json(manifest));
    }
    write('report.json', json(report));
    requireCondition(!fileSystem.existsSync(target), 'OUTPUT_EXISTS');
    fileSystem.renameSync(staging, target);
  } catch (error) {
    if (staging) {
      try {
        for (const file of written) fileSystem.rmSync(file, { force: true });
        fileSystem.rmdirSync(staging);
      } catch {
        throw new LandmarkBuildError('ARTIFACT_CLEANUP', true);
      }
    }
    if (error instanceof LandmarkBuildError) throw error;
    throw new LandmarkBuildError('ARTIFACT_WRITE', true);
  }
}

module.exports = { prepareEpisodes, fixedSample, progressiveSample, buildArtifacts, compareMatchers,
  assessGate, verifyArtifacts, publishArtifacts };
